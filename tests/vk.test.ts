import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatPrice } from "@/lib/listings";
import type { Database } from "@/server/db";
import { LEGAL_VERSION } from "@/lib/legal";

vi.mock("@/server/storage", () => ({
  readPhoto: vi.fn(async () =>
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  ),
}));

import {
  publishListingToVk,
  tryPublishListingToVk,
  vkConfigured,
  vkMessage,
} from "@/server/vk";

const ENV_KEYS = ["VK_GROUP_TOKEN", "VK_GROUP_ID", "APP_URL"] as const;
const saved = {} as Record<string, string | undefined>;

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  delete process.env.VK_GROUP_TOKEN;
  delete process.env.VK_GROUP_ID;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function listingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "listing-1",
    title: "Кальян Khalil Mamoon Mini",
    city: "Иркутск",
    priceKopecks: 650000,
    status: "published",
    vkPostId: null,
    legalVersion: LEGAL_VERSION,
    category: "bowls",
    country: "RU",
    ...overrides,
  };
}

function fakeDb(listing: Record<string, unknown>, photo = true) {
  const updates: Array<Record<string, unknown>> = [];
  const db = {
    transaction: async (work: (tx: unknown) => unknown): Promise<unknown> => work(db),
    select: vi
      .fn()
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({ limit: () => ({ for: async () => [listing] }) }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => (photo ? [{ storageKey: "photo-key" }] : []),
            }),
          }),
        }),
      }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updates.push(values);
        },
      }),
    }),
  };
  return { db: db as unknown as Database, updates };
}

function vkFetchMock() {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    if (target.includes("photos.getWallUploadServer"))
      return Response.json({ response: { upload_url: "https://upload.vk.test/1" } });
    if (target === "https://upload.vk.test/1")
      return Response.json({ photo: "[]", server: 123, hash: "hash" });
    if (target.includes("photos.saveWallPhoto"))
      return Response.json({ response: [{ id: 777, owner_id: -90328237 }] });
    if (target.includes("wall.post"))
      return Response.json({ response: { post_id: 42 } });
    throw new Error(`unexpected fetch: ${target} ${init?.method ?? ""}`);
  });
}

describe("VK autoposting", () => {
  it("stays off until token and group id are both configured", () => {
    expect(vkConfigured()).toBe(false);
    process.env.VK_GROUP_TOKEN = "token";
    expect(vkConfigured()).toBe(false);
    process.env.VK_GROUP_ID = "-90328237";
    expect(vkConfigured()).toBe(false);
    process.env.VK_GROUP_ID = "90328237";
    expect(vkConfigured()).toBe(true);
  });

  it("builds a short native post with title, price, city and link", () => {
    process.env.APP_URL = "https://shisha-market.com/";
    const message = vkMessage(listingRow());
    expect(message).toContain(`Кальян Khalil Mamoon Mini — ${formatPrice(650000)}`);
    expect(message).toContain("Иркутск");
    expect(message).toContain("https://shisha-market.com/listings/listing-1");
    expect(message).not.toContain("//listings");
  });

  it("does nothing without configuration", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { db } = fakeDb(listingRow());
    expect(await publishListingToVk(db, "listing-1")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads the photo and posts to the community wall once", async () => {
    process.env.VK_GROUP_TOKEN = "secret-token";
    process.env.VK_GROUP_ID = "90328237";
    process.env.APP_URL = "https://shisha-market.com";
    const fetchMock = vkFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    const { db, updates } = fakeDb(listingRow());

    expect(await publishListingToVk(db, "listing-1")).toBe("42");

    const calls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calls).toEqual([
      "https://api.vk.com/method/photos.getWallUploadServer",
      "https://upload.vk.test/1",
      "https://api.vk.com/method/photos.saveWallPhoto",
      "https://api.vk.com/method/wall.post",
    ]);
    for (const [, init] of fetchMock.mock.calls.slice(0, 1)) {
      const body = (init as RequestInit).body as URLSearchParams;
      expect(body.get("group_id")).toBe("90328237");
      expect(body.get("access_token")).toBe("secret-token");
    }
    const wallBody = (fetchMock.mock.calls[3][1] as RequestInit)
      .body as URLSearchParams;
    expect(wallBody.get("owner_id")).toBe("-90328237");
    expect(wallBody.get("from_group")).toBe("1");
    expect(wallBody.get("guid")).toMatch(/^[a-f0-9]{32}$/);
    expect(wallBody.get("attachments")).toContain("photo-90328237_777");
    expect(wallBody.get("attachments")).toContain(
      "https://shisha-market.com/listings/listing-1",
    );
    expect(updates).toEqual([{ vkPostId: "42" }]);
  });

  it("never posts the same listing twice", async () => {
    process.env.VK_GROUP_TOKEN = "secret-token";
    process.env.VK_GROUP_ID = "90328237";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { db } = fakeDb(listingRow({ vkPostId: "42" }));
    expect(await publishListingToVk(db, "listing-1")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { status: "pending" },
    { status: "archived" },
    { legalVersion: "outdated-consent" },
    { category: "unapproved-category" },
  ])("does not export hidden or unapproved listings: %j", async (overrides) => {
    process.env.VK_GROUP_TOKEN = "secret-token";
    process.env.VK_GROUP_ID = "90328237";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { db } = fakeDb(listingRow(overrides));
    expect(await publishListingToVk(db, "listing-1")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reuses the guid after a post succeeded but recording its id failed", async () => {
    process.env.VK_GROUP_TOKEN = "secret-token";
    process.env.VK_GROUP_ID = "90328237";
    const fetchMock = vkFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    const first = fakeDb(listingRow());
    vi.spyOn(first.db, "update").mockImplementation(() => {
      throw new Error("synthetic commit failure");
    });
    await expect(publishListingToVk(first.db, "listing-1")).rejects.toThrow("synthetic commit failure");
    await publishListingToVk(fakeDb(listingRow()).db, "listing-1");
    const posts = fetchMock.mock.calls.filter(([url]) => String(url).includes("wall.post"));
    expect(posts).toHaveLength(2);
    const guids = posts.map(([, init]) => (init?.body as URLSearchParams).get("guid"));
    expect(guids[0]).toBeTruthy();
    expect(guids[0]).toBe(guids[1]);
  });

  it("keeps moderation successful when VK is unavailable", async () => {
    process.env.VK_GROUP_TOKEN = "secret-token";
    process.env.VK_GROUP_ID = "90328237";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fakeDb(listingRow());
    expect(await tryPublishListingToVk(db, "listing-1")).toBeNull();
    expect(spy).toHaveBeenCalledWith(
      "VK autopost failed for listing listing-1:",
      "network down",
    );
  });
});
