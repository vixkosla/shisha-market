import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { migrate as migrateEmbedded } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { createEmbeddedDatabase, createPostgresDatabase } from "@/server/db";
import {
  user,
  listings,
  photos,
  favorites,
  moderationEvents,
  legalAcceptances,
  supportRequests,
} from "@/server/db/schema";
import {
  createListing,
  getCatalog,
  listPublicSitemapEntries,
  moderateListing,
  setFavorite,
  archiveListing,
} from "@/server/listings";
import { createAuth, handleAuthRequest } from "@/server/auth";
import { preparePhoto } from "@/server/storage";
import { listingInput, canRead, formatPrice } from "@/lib/listings";
import {
  LEGAL_VERSION,
  legalHeaders,
  type PublicationAcceptance,
} from "@/lib/legal";
import {
  submitRequest,
  requestsFor,
  resolveRequest,
  submitSuggestion,
} from "@/server/support";
import { hasCurrentAccountAcceptance } from "@/server/legal-acceptance";

const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl && !/^\/shisha_verify_[a-z0-9_]+$/.test(new URL(testUrl).pathname))
  throw new Error(
    "PostgreSQL integration tests require a new shisha_verify_* database",
  );
const embedded = testUrl ? undefined : new PGlite();
const pool = testUrl
  ? new Pool({ connectionString: testUrl, max: 2 })
  : undefined;
const db = pool
  ? createPostgresDatabase(pool)
  : createEmbeddedDatabase(embedded!);
const migrate = async () => {
  if (pool)
    await migratePostgres(createPostgresDatabase(pool), {
      migrationsFolder: "drizzle",
    });
  else
    await migrateEmbedded(createEmbeddedDatabase(embedded!), {
      migrationsFolder: "drizzle",
    });
};
const owner = { id: "owner", role: "member" as const };
const stranger = { id: "stranger", role: "member" as const };
const moderator = { id: "moderator", role: "moderator" as const };
const input = {
  title: "Тестовая керамическая чаша",
  description:
    "Синтетическое объявление для проверки работы площадки, не предложение продажи.",
  category: "bowls",
  country: "RU",
  city: "Москва",
  price: "2500,50",
  condition: "used",
  contactUrl: "https://vk.ru/test_profile",
};
const photo = { storageKey: "unit-test.webp", width: 100, height: 100 };
const consent: PublicationAcceptance = {
  version: LEGAL_VERSION,
  fullName: "Тестовый Автор",
  personalItem: true,
  adult: true,
  contact: true,
  city: true,
  conditions: "Только по существу объявления",
};
beforeAll(async () => {
  await migrate();
  await migrate();
  await db.insert(user).values(
    [owner, stranger, moderator].map((actor) => ({
      ...actor,
      email: `${actor.id}@example.test`,
      name: actor.id,
      emailVerified: true,
    })),
  );
  await db.insert(legalAcceptances).values(
    [owner, stranger, moderator].flatMap((actor) =>
      ["terms", "processing"].map((kind) => ({
        id: `synthetic-${actor.id}-${kind}`,
        userId: actor.id,
        kind,
        version: LEGAL_VERSION,
        evidence: { synthetic: true },
      })),
    ),
  );
});
afterAll(async () => {
  await embedded?.close();
  await pool?.end();
});

describe("public suggestions", () => {
  it("stores an idea without an account", async () => {
    const id = await submitSuggestion(
      db,
      {
        contact: "https://vk.ru/test_profile",
        message: "Добавьте фильтр по состоянию чаши, так проще искать.",
      },
      "test-fingerprint",
    );
    expect(id.length).toBeGreaterThan(8);
  });
});
describe("input and access rules", () => {
  it("stores money as integer kopecks", () => {
    expect(listingInput.parse(input).price).toBe(250050);
    expect(formatPrice(250000)).toContain("2");
  });
  it.each(["-1", "1e3", "1.999", "Infinity", "99999999"])(
    "rejects invalid price %s",
    (price) =>
      expect(listingInput.safeParse({ ...input, price }).success).toBe(false),
  );
  it.each([
    "javascript:alert(1)",
    "https://vk.ru.evil.test/a",
    "https://evil@vk.ru/a",
    "https://vk.ru/a?redirect=evil",
    "https://vk.ru/login/redirect",
    "http://vk.ru/a",
  ])("rejects unsafe contact %s", (contactUrl) =>
    expect(listingInput.safeParse({ ...input, contactUrl }).success).toBe(
      false,
    ),
  );
  it("hides non-public content from strangers", () => {
    expect(canRead("pending", owner.id, stranger)).toBe(false);
    expect(canRead("rejected", owner.id)).toBe(false);
    expect(canRead("pending", owner.id, owner)).toBe(true);
    expect(canRead("pending", owner.id, moderator)).toBe(true);
    expect(canRead("published", owner.id)).toBe(true);
  });
});
describe("publication lifecycle", () => {
  it("requires a photo", async () =>
    expect(
      createListing(db, owner, listingInput.parse(input), [], consent),
    ).rejects.toThrow("фотографий"));
  it("keeps pending content private, then publishes, searches, favorites and archives", async () => {
    const id = await createListing(
      db,
      owner,
      listingInput.parse(input),
      [photo],
      consent,
    );
    expect(
      (await db.select().from(photos).where(eq(photos.listingId, id))).length,
    ).toBe(1);
    expect((await getCatalog(db, {})).items).toHaveLength(0);
    await expect(
      moderateListing(db, stranger, id, "published", "", 1),
    ).rejects.toThrow("прав");
    await expect(setFavorite(db, stranger, id, true)).rejects.toThrow(
      "недоступно",
    );
    await expect(archiveListing(db, stranger, id)).rejects.toThrow(
      "не найдено",
    );
    await moderateListing(db, moderator, id, "published", "Проверено", 1);
    expect(
      (
        await getCatalog(db, {
          q: "керамическая",
          category: "bowls",
          city: "Москва",
        })
      ).items[0].id,
    ).toBe(id);
    expect(
      (await listPublicSitemapEntries(db)).some((row) => row.id === id),
    ).toBe(true);
    expect((await getCatalog(db, { city: "Казань" })).items).toHaveLength(0);
    expect(
      (await getCatalog(db, { q: "'; DROP TABLE users; --" })).items,
    ).toHaveLength(0);
    await expect(
      moderateListing(db, moderator, id, "rejected", "Повторное решение", 1),
    ).rejects.toThrow("уже обработано");
    expect((await db.select().from(moderationEvents)).length).toBe(1);
    await setFavorite(db, stranger, id, true);
    await setFavorite(db, stranger, id, true);
    expect((await db.select().from(favorites)).length).toBe(1);
    await setFavorite(db, stranger, id, false);
    expect((await db.select().from(favorites)).length).toBe(0);
    await archiveListing(db, owner, id);
    expect((await getCatalog(db, {})).items).toHaveLength(0);
    expect(
      (await listPublicSitemapEntries(db)).some((row) => row.id === id),
    ).toBe(false);
  });
  it("records rejection reason and rolls back conflicting mutations", async () => {
    const id = await createListing(
      db,
      owner,
      listingInput.parse(input),
      [{ ...photo, storageKey: "second.webp" }],
      consent,
    );
    await expect(
      moderateListing(db, moderator, id, "rejected", "", 1),
    ).rejects.toThrow("причину");
    await moderateListing(
      db,
      moderator,
      id,
      "rejected",
      "Нужно уточнить состояние",
      1,
    );
    const [item] = await db.select().from(listings).where(eq(listings.id, id));
    expect(item.status).toBe("rejected");
    expect(item.moderationNote).toContain("состояние");
    const before = (await db.select().from(listings)).length;
    await expect(
      createListing(db, owner, listingInput.parse(input), [photo], consent),
    ).rejects.toThrow();
    expect((await db.select().from(listings)).length).toBe(before);
  });
  it("enforces the creation quota within the transaction", async () => {
    await db
      .insert(user)
      .values({ id: "quota", email: "quota@example.test", name: "Quota test" });
    await db
      .insert(legalAcceptances)
      .values(
        ["terms", "processing"].map((kind) => ({
          id: `synthetic-quota-${kind}`,
          userId: "quota",
          kind,
          version: LEGAL_VERSION,
          evidence: { synthetic: true },
        })),
      );
    await db.insert(listings).values(
      Array.from({ length: 20 }, (_, index) => ({
        id: `quota-${index}`,
        ownerId: "quota",
        title: "Quota test",
        description: "Synthetic data",
        category: "bowls",
        city: "Москва",
        priceKopecks: 100,
        condition: "used" as const,
        contactUrl: "https://vk.ru/test",
      })),
    );
    await expect(
      createListing(
        db,
        { id: "quota", role: "member" },
        listingInput.parse(input),
        [{ ...photo, storageKey: "quota.webp" }],
        consent,
      ),
    ).rejects.toThrow("20 объявлений");
  });
});
describe("photo normalization", () => {
  it("accepts real image bytes and outputs stripped WebP", async () => {
    const bytes = await sharp({
      create: { width: 32, height: 24, channels: 3, background: "#baa" },
    })
      .png()
      .toBuffer();
    const output = await preparePhoto(
      new File([new Uint8Array(bytes)], "test.png"),
    );
    const meta = await sharp(output.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(output.width).toBe(32);
  });
  it("rejects disguised non-images", async () =>
    expect(
      preparePhoto(new File(["<svg onload='alert(1)'></svg>"], "photo.png")),
    ).rejects.toThrow("прочитать"));
  it("rejects oversized uploads before reading", async () =>
    expect(
      preparePhoto({
        size: 9 * 1024 * 1024,
        arrayBuffer: async () => {
          throw new Error("Should not read");
        },
      }),
    ).rejects.toThrow("8 МБ"));
});
describe("real Better Auth routes", () => {
  it("closes unused OTP and password recovery paths even with consent headers", async () => {
    let sent = 0;
    const auth = createAuth(db, async () => {
      sent++;
    });
    const paths = [
      "email-otp/request-password-reset",
      "forget-password/email-otp",
      "sign-in/social",
    ];
    for (const [index, path] of paths.entries()) {
      const response = await auth.handler(
        new Request(`http://127.0.0.1:4387/api/auth/${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://127.0.0.1:4387",
            "x-forwarded-for": `192.0.2.${index + 40}`,
            ...legalHeaders,
          },
          body: JSON.stringify({ email: "owner@example.test", provider: "vk" }),
        }),
      );
      expect([403, 404]).toContain(response.status);
    }
    expect(sent).toBe(0);
  });
  it("signs in with a one-time code, ignores injected role, and rejects cross-origin POST", async () => {
    let otp = "";
    const auth = createAuth(db, async (data) => {
      otp = data.otp;
    });
    const origin = "http://127.0.0.1:4387";
    const call = (path: string, body: object, requestOrigin = origin) =>
      handleAuthRequest(
        auth,
        new Request(`${origin}/api/auth/${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: requestOrigin,
            ...legalHeaders,
          },
          body: JSON.stringify(body),
        }),
      );
    expect(
      (
        await call("email-otp/send-verification-otp", {
          email: "test@example.test",
          type: "sign-in",
        })
      ).status,
    ).toBe(200);
    expect(otp).toMatch(/^\d{6}$/);
    const response = await call("sign-in/email-otp", {
      email: "test@example.test",
      otp,
      name: "Synthetic test",
      role: "admin",
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.user.role).toBe("member");
    const records = await db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.userId, result.user.id));
    expect(records.map((record) => record.kind).sort()).toEqual([
      "processing",
      "terms",
    ]);
    expect(records.every((record) => record.version === LEGAL_VERSION)).toBe(
      true,
    );
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const sessionResponse = await auth.handler(
      new Request(`${origin}/api/auth/get-session`, {
        headers: { Cookie: cookie },
      }),
    );
    expect((await sessionResponse.json()).user.email).toBe("test@example.test");
    expect(
      (await call("sign-in/email-otp", { email: "test@example.test", otp }))
        .status,
    ).not.toBe(200);
    expect(
      (
        await call(
          "email-otp/send-verification-otp",
          { email: "other@example.test", type: "sign-in" },
          "https://evil.test",
        )
      ).status,
    ).toBe(403);
  });
  it("promotes the operator contact to admin after a verified sign-in", async () => {
    const previous = process.env.LEGAL_CONTACT_EMAIL;
    process.env.LEGAL_CONTACT_EMAIL = "operator@example.test";
    try {
      let otp = "";
      const auth = createAuth(db, async (data) => {
        otp = data.otp;
      });
      const origin = "http://127.0.0.1:4387";
      const call = (path: string, body: object) =>
        handleAuthRequest(
          auth,
          new Request(`${origin}/api/auth/${path}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: origin,
              ...legalHeaders,
            },
            body: JSON.stringify(body),
          }),
        );
      expect(
        (
          await call("email-otp/send-verification-otp", {
            email: "operator@example.test",
            type: "sign-in",
          })
        ).status,
      ).toBe(200);
      const response = await call("sign-in/email-otp", {
        email: "operator@example.test",
        otp,
      });
      expect(response.status).toBe(200);
      const result = await response.json();
      const rows = await db
        .select()
        .from(user)
        .where(eq(user.id, result.user.id));
      expect(rows[0]?.role).toBe("admin");
    } finally {
      process.env.LEGAL_CONTACT_EMAIL = previous;
    }
  });
  it("rejects missing or stale legal acceptance before sending email, including direct handlers", async () => {
    let sent = 0;
    const auth = createAuth(db, async () => {
      sent++;
    });
    const variants = [
      {},
      { ...legalHeaders, "x-shisha-terms": "old" },
      { ...legalHeaders, "x-shisha-processing": "" },
      { ...legalHeaders, "x-shisha-adult": "no" },
    ];
    for (const [index, headers] of variants.entries()) {
      const response = await auth.handler(
        new Request(
          "http://127.0.0.1:4387/api/auth/email-otp/send-verification-otp",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: "http://127.0.0.1:4387",
              "x-forwarded-for": `192.0.2.${index + 10}`,
              ...headers,
            } as Record<string, string>,
            body: JSON.stringify({
              email: "missing-consent@example.test",
              type: "sign-in",
            }),
          },
        ),
      );
      expect(response.status).toBe(400);
    }
    expect(sent).toBe(0);
  });
});

describe("legal publication and confidential support", () => {
  it("old account sessions need current base consent to publish, but can still request withdrawal", async () => {
    const legacy = { id: "legacy", role: "member" as const };
    await db
      .insert(user)
      .values({
        id: legacy.id,
        name: "Synthetic legacy",
        email: "legacy@example.test",
      });
    await db
      .insert(legalAcceptances)
      .values(
        ["terms", "processing"].map((kind) => ({
          id: `old-${kind}`,
          userId: legacy.id,
          kind,
          version: "old",
          evidence: { synthetic: true },
        })),
      );
    expect(await hasCurrentAccountAcceptance(db, legacy.id)).toBe(false);
    await expect(
      createListing(
        db,
        legacy,
        listingInput.parse(input),
        [{ ...photo, storageKey: "legacy.webp" }],
        consent,
      ),
    ).rejects.toThrow("подтвердите вход");
    await expect(
      submitRequest(db, legacy, {
        kind: "withdraw",
        listingId: "",
        message: "Отзываю ранее данное согласие",
      }),
    ).resolves.toBeTruthy();
  });
  it("cannot create a listing without separate current consent", async () => {
    await expect(
      createListing(db, owner, listingInput.parse(input), [photo], {
        ...consent,
        contact: false,
      } as unknown as PublicationAcceptance),
    ).rejects.toThrow("ссылки");
    await expect(
      createListing(db, owner, listingInput.parse(input), [photo], {
        ...consent,
        version: "old",
      } as unknown as PublicationAcceptance),
    ).rejects.toThrow("обновились");
    await expect(
      createListing(
        db,
        owner,
        listingInput.parse({ ...input, condition: "new" }),
        [photo],
        consent,
      ),
    ).rejects.toThrow("использовании");
    await expect(
      createListing(
        db,
        owner,
        listingInput.parse({ ...input, title: "Тестовый никотин" }),
        [photo],
        consent,
      ),
    ).rejects.toThrow("не принимаются");
  });
  it("saves a private consent snapshot, limits complaint visibility and allows moderator takedown", async () => {
    const id = await createListing(
      db,
      owner,
      listingInput.parse(input),
      [{ ...photo, storageKey: "complaint.webp" }],
      consent,
    );
    const [record] = await db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.listingId, id));
    expect(record.evidence.fullName).toBe(consent.fullName);
    expect(record.evidence.contactUrl).toBe(input.contactUrl);
    expect(record.evidence.document).toBeDefined();
    await expect(
      submitRequest(db, stranger, {
        kind: "report",
        listingId: id,
        message: "Синтетическая жалоба на закрытую запись",
      }),
    ).rejects.toThrow("недоступно");
    await moderateListing(db, moderator, id, "published", "Проверено", 1);
    const requestId = await submitRequest(db, stranger, {
      kind: "report",
      listingId: id,
      message: "Синтетическая жалоба на публикацию",
    });
    expect(
      (await requestsFor(db, owner)).find((item) => item.id === requestId),
    ).toBeUndefined();
    expect(
      (await requestsFor(db, stranger)).some((item) => item.id === requestId),
    ).toBe(true);
    await expect(requestsFor(db, stranger, true)).rejects.toThrow("прав");
    await expect(
      resolveRequest(db, owner, requestId, "Достаточно подробный ответ", true),
    ).rejects.toThrow("прав");
    await resolveRequest(
      db,
      moderator,
      requestId,
      "Проверили и сняли публикацию",
      true,
    );
    expect(
      (await db.select().from(listings).where(eq(listings.id, id)))[0].status,
    ).toBe("archived");
    expect(
      (await requestsFor(db, stranger)).find((item) => item.id === requestId)
        ?.resolution,
    ).toContain("сняли");
    await expect(
      resolveRequest(
        db,
        moderator,
        requestId,
        "Повторный ответ запрещён",
        true,
      ),
    ).rejects.toThrow("уже рассмотрено");
  });
  it("withdrawal hides only the authenticated user's listings and records the request", async () => {
    const mine = await createListing(
      db,
      owner,
      listingInput.parse(input),
      [{ ...photo, storageKey: "withdraw-own.webp" }],
      consent,
    );
    const other = await createListing(
      db,
      stranger,
      listingInput.parse(input),
      [{ ...photo, storageKey: "withdraw-other.webp" }],
      consent,
    );
    await moderateListing(db, moderator, mine, "published", "Проверено", 1);
    await moderateListing(db, moderator, other, "published", "Проверено", 1);
    const requestId = await submitRequest(db, owner, {
      kind: "withdraw",
      listingId: "",
      message: "Отзываю публикацию моих данных",
    });
    expect(
      (await db.select().from(listings).where(eq(listings.id, mine)))[0].status,
    ).toBe("archived");
    expect(
      (await db.select().from(listings).where(eq(listings.id, other)))[0]
        .status,
    ).toBe("published");
    expect(
      (await requestsFor(db, owner)).some((item) => item.id === requestId),
    ).toBe(true);
    await archiveListing(db, stranger, other);
  });
  it("shows newer support answers after the first hundred requests", async () => {
    await db
      .insert(supportRequests)
      .values(
        Array.from({ length: 101 }, (_, index) => ({
          id: `page-${index}`,
          userId: stranger.id,
          kind: "access",
          message: "Синтетический запрос",
          status: "resolved",
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
        })),
      );
    const requests = await requestsFor(db, stranger);
    expect(requests).toHaveLength(100);
    expect(requests.some((request) => request.id === "page-100")).toBe(true);
    expect(requests.some((request) => request.id === "page-0")).toBe(false);
  });
});
