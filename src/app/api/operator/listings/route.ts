import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainError, listingInput } from "@/lib/listings";
import { getDatabase } from "@/server/db";
import {
  createOperatorListing,
  listPendingListings,
  operatorActor,
} from "@/server/listings";
import { operatorAuthorized, operatorTokenConfigured } from "@/server/operator";
import { preparePhoto, storePhoto, deletePhoto } from "@/server/storage";
import { decodeOperatorPhotos, operatorPhotoInput, OperatorRequestError, readOperatorJson } from "@/server/operator-api";
import { queueListingReviewNotice } from "@/server/listing-notifications";

export const dynamic = "force-dynamic";

function missing() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

const operatorInput = listingInput.extend({
  publish: z.boolean().default(false),
  photos: z.array(operatorPhotoInput).min(1, "Добавьте от 1 до 6 фотографий.").max(6, "Добавьте от 1 до 6 фотографий."),
});

export async function GET(request: Request) {
  if (!operatorTokenConfigured()) return missing();
  if (!operatorAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDatabase();
    const actor = await operatorActor(db);
    const items = await listPendingListings(db, actor);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof DomainError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}

export async function POST(request: Request) {
  if (!operatorTokenConfigured()) return missing();
  if (!operatorAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await readOperatorJson(request); } catch (error) {
    if (error instanceof OperatorRequestError) return NextResponse.json({error: error.message}, {status: error.status});
    throw error;
  }
  if (!body) return NextResponse.json({ error: "Нужен JSON." }, { status: 400 });
  const parsed = operatorInput.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const { photos: files, publish, ...input } = parsed.data;
  const stored: string[] = [];
  try {
    const decoded = decodeOperatorPhotos(files);
    const db = await getDatabase();
    await operatorActor(db);
    const images = [];
    for (const raw of decoded) {
      if (!raw.length) throw new DomainError("Фотография пустая.");
      const image = await preparePhoto({
        size: raw.length,
        arrayBuffer: async () =>
          raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
      });
      stored.push(image.storageKey);
      await storePhoto(image.storageKey, image.data);
      images.push({
        storageKey: image.storageKey,
        width: image.width,
        height: image.height,
      });
    }
    const result = await createOperatorListing(
      db,
      input,
      images,
      publish,
    );
    if (!publish) queueListingReviewNotice(result.id, result.revision);
    return NextResponse.json(result);
  } catch (error) {
    await Promise.allSettled(stored.map(deletePhoto));
    if (error instanceof DomainError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Operator listing failed", error);
    return NextResponse.json(
      { error: "Не удалось сохранить объявление." },
      { status: 500 },
    );
  }
}
