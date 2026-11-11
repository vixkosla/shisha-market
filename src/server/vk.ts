import sharp from "sharp";
import { createHash } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { LEGAL_VERSION } from "@/lib/legal";
import { formatPrice } from "@/lib/listings";
import type { Database } from "@/server/db";
import { listings, photos } from "@/server/db/schema";
import { readPhoto } from "@/server/storage";
import { listingMarketAllowed } from "@/server/legal-policy";

const API = "https://api.vk.com/method";
const VERSION = "5.199";

function config() {
  const token = process.env.VK_GROUP_TOKEN?.trim();
  const group = process.env.VK_GROUP_ID?.trim();
  if (!token || !group || !/^[1-9]\d*$/.test(group)) return null;
  return { token, group };
}

export function vkConfigured() {
  return config() !== null;
}

function siteUrl() {
  return (process.env.APP_URL ?? "https://shisha-market.com").replace(/\/$/, "");
}

export function vkMessage(listing: {
  id: string;
  title: string;
  city: string;
  priceKopecks: number;
}) {
  return [
    "Новое объявление на Shisha Market",
    "",
    `${listing.title} — ${formatPrice(listing.priceKopecks)}`,
    listing.city,
    "",
    `${siteUrl()}/listings/${listing.id}`,
  ].join("\n");
}

async function call(
  token: string,
  method: string,
  params: Record<string, string>,
) {
  const body = new URLSearchParams({
    ...params,
    access_token: token,
    v: VERSION,
  });
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`VK ${method}: HTTP ${response.status}`);
  const data = (await response.json().catch(() => null)) as {
    response?: unknown;
    error?: { error_msg?: string };
  } | null;
  if (!data) throw new Error(`VK ${method}: invalid response`);
  if (data.error)
    throw new Error(`VK ${method}: ${data.error.error_msg ?? "unknown error"}`);
  return data.response;
}

async function uploadWallPhoto(token: string, group: string, raw: Uint8Array) {
  const jpeg = await sharp(Buffer.from(raw))
    .rotate()
    .jpeg({ quality: 88 })
    .toBuffer();
  const server = (await call(token, "photos.getWallUploadServer", {
    group_id: group,
  })) as { upload_url?: string } | undefined;
  if (!server?.upload_url) throw new Error("VK upload server unavailable");
  const form = new FormData();
  form.append(
    "photo",
    new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }),
    "listing.jpg",
  );
  const uploaded = await fetch(server.upload_url, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(20000),
  });
  if (!uploaded.ok) throw new Error(`VK upload HTTP ${uploaded.status}`);
  const file = (await uploaded.json().catch(() => null)) as {
    photo?: string;
    server?: number | string;
    hash?: string;
  } | null;
  if (!file?.photo || file.server === undefined || !file.hash)
    throw new Error("VK upload rejected photo");
  const saved = (await call(token, "photos.saveWallPhoto", {
    group_id: group,
    photo: file.photo,
    server: String(file.server),
    hash: file.hash,
  })) as Array<{ id: number; owner_id: number }> | undefined;
  const photo = saved?.[0];
  if (!photo) throw new Error("VK did not save photo");
  return `photo${photo.owner_id}_${photo.id}`;
}

export async function publishListingToVk(db: Database, id: string) {
  const cfg = config();
  if (!cfg) return null;
  // Keep edits, archiving and other publishers behind the same row lock until
  // the remote result is recorded. A stable guid also covers a lost response
  // or database commit failure after VK has already accepted the post.
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select({
        id: listings.id,
        title: listings.title,
        city: listings.city,
        priceKopecks: listings.priceKopecks,
        status: listings.status,
        vkPostId: listings.vkPostId,
        legalVersion: listings.legalVersion,
        category: listings.category,
        country: listings.country,
      })
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1)
      .for("update");
    if (
      !item || item.status !== "published" || item.vkPostId ||
      item.legalVersion !== LEGAL_VERSION || !listingMarketAllowed(item)
    ) return null;
    const [photo] = await tx
      .select({ storageKey: photos.storageKey })
      .from(photos)
      .where(eq(photos.listingId, id))
      .orderBy(asc(photos.position))
      .limit(1);
    let attachment: string | null = null;
    if (photo) {
      const raw = await readPhoto(photo.storageKey);
      if (raw.length) attachment = await uploadWallPhoto(cfg.token, cfg.group, raw);
    }
    const url = `${siteUrl()}/listings/${id}`;
    const result = (await call(cfg.token, "wall.post", {
      owner_id: `-${cfg.group}`,
      from_group: "1",
      guid: createHash("sha256").update(`${cfg.group}:${id}`).digest("hex").slice(0, 32),
      message: vkMessage(item),
      attachments: [attachment, url].filter(Boolean).join(","),
    })) as { post_id?: number } | undefined;
    if (!result?.post_id) throw new Error("VK did not return post id");
    await tx
      .update(listings)
      .set({ vkPostId: String(result.post_id) })
      .where(eq(listings.id, id));
    return String(result.post_id);
  });
}

export async function tryPublishListingToVk(db: Database, id: string) {
  try {
    return await publishListingToVk(db, id);
  } catch (error) {
    console.error(
      `VK autopost failed for listing ${id}:`,
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
}
