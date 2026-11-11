import {beforeAll, afterAll, afterEach, describe, expect, it, vi} from "vitest";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {migrate} from "drizzle-orm/pglite/migrator";
import {eq} from "drizzle-orm";
import {createEmbeddedDatabase} from "@/server/db";
import {agentConnections, agentPairings, legalAcceptances, user} from "@/server/db/schema";
import {agentActor, beginPairing, finishPairing, approvePairing, revokeConnection} from "@/server/agent-auth";
import {handleMemberRequest} from "@/server/member-api";
import {createListing} from "@/server/listings";
import {listingInput} from "@/lib/listings";
import {LEGAL_VERSION, type PublicationAcceptance} from "@/lib/legal";
import {safeLoginReturn} from "@/lib/login-return";

vi.mock("@/server/db", async original => ({...await original<typeof import("@/server/db")>(), getDatabase: async () => db}));
vi.mock("@/server/listing-notifications", () => ({queueListingReviewNotice: vi.fn()}));
const embedded = new PGlite();
const db = createEmbeddedDatabase(embedded);
const alice = {id: "agent-alice", role: "admin" as const}, bob = {id: "agent-bob", role: "member" as const};
const acceptance: PublicationAcceptance = {version: LEGAL_VERSION, fullName: "Synthetic Test Person", personalItem: true, adult: true, contact: true, city: true, conditions: ""};
const request = (token: string, method = "GET", body?: unknown) => new Request("http://127.0.0.1:4387/api/member/listings", {method, headers: {authorization: `Bearer ${token}`, "content-type": "application/json"}, body: body ? JSON.stringify(body) : undefined});
async function connection(actor = alice) {
  const pair = await beginPairing(db, "Synthetic assistant", randomUUID());
  await approvePairing(db, actor, pair.id, pair.userCode);
  const result = await finishPairing(db, pair.id, pair.deviceSecret);
  if (result.status !== "connected") throw new Error("Expected connected");
  return {pair, ...result};
}
beforeAll(async () => {
  await migrate(db, {migrationsFolder: "drizzle"});
  await db.insert(user).values([alice, bob].map(actor => ({...actor, name: actor.id, email: `${actor.id}@example.test`, emailVerified: true})));
  await db.insert(legalAcceptances).values([alice, bob].flatMap(actor => ["terms", "processing"].map(kind => ({id: randomUUID(), userId: actor.id, version: LEGAL_VERSION, kind, evidence: {synthetic: true}}))));
}, 30000);
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => embedded.close());

describe("personal agent authorization", () => {
  it("requires approval and the device secret; preserves the login destination without open redirects", async () => {
    const pair = await beginPairing(db, "My agent", randomUUID());
    expect(await finishPairing(db, pair.id, pair.deviceSecret)).toEqual({status: "pending"});
    await expect(approvePairing(db, alice, pair.id, "BADCODE0")).rejects.toThrow();
    await approvePairing(db, alice, pair.id, pair.userCode);
    await expect(finishPairing(db, pair.id, "a".repeat(43))).rejects.toThrow();
    const result = await finishPairing(db, pair.id, pair.deviceSecret);
    expect(result.status).toBe("connected");
    await expect(finishPairing(db, pair.id, pair.deviceSecret)).rejects.toThrow();
    expect(safeLoginReturn(`/account/mcp?request=${pair.id}&next=https://evil.test`)).toBe(`/account/mcp?request=${pair.id}`);
    expect(safeLoginReturn("//evil.test/account/mcp")).toBe("/account");
  });
  it("stores only token digests and never grants the owner's administrator privileges", async () => {
    const connected = await connection();
    expect(await agentActor(db, request(connected.token))).toEqual({id: alice.id, role: "member", connectionId: connected.connectionId});
    const [stored] = await db.select().from(agentConnections).where(eq(agentConnections.id, connected.connectionId));
    expect(JSON.stringify(stored)).not.toContain(connected.token);
    expect(stored.tokenHash).toHaveLength(64);
    expect((await handleMemberRequest(request("a".repeat(64)), ["listings"])).status).toBe(401);
    const foreignOrigin = request(connected.token); foreignOrigin.headers.set("origin", "https://evil.test");
    await expect(agentActor(db, foreignOrigin)).rejects.toThrow("источник");
  });
  it("makes pairing one-time even when redemption races", async () => {
    const pair = await beginPairing(db, "One time", randomUUID());
    await approvePairing(db, alice, pair.id, pair.userCode);
    const result = await Promise.allSettled([finishPairing(db, pair.id, pair.deviceSecret), finishPairing(db, pair.id, pair.deviceSecret)]);
    expect(result.filter(item => item.status === "fulfilled")).toHaveLength(1);
  });
  it("rejects expired pairing and credentials, disabled authentication and revocation", async () => {
    const pair = await beginPairing(db, "Expired", randomUUID());
    await db.update(agentPairings).set({expiresAt: new Date(0)}).where(eq(agentPairings.id, pair.id));
    await expect(approvePairing(db, alice, pair.id, pair.userCode)).rejects.toThrow();
    const connected = await connection();
    await revokeConnection(db, bob.id, connected.connectionId);
    expect((await agentActor(db, request(connected.token))).id).toBe(alice.id);
    await revokeConnection(db, alice.id, connected.connectionId);
    await expect(agentActor(db, request(connected.token))).rejects.toThrow();
    const expiring = await connection();
    await db.update(agentConnections).set({expiresAt: new Date(0)}).where(eq(agentConnections.id, expiring.connectionId));
    await expect(agentActor(db, request(expiring.token))).rejects.toThrow();
    vi.stubEnv("AUTH_ENABLED", "false");
    await expect(beginPairing(db, "Disabled", randomUUID())).rejects.toThrow();
  });
  it("rejects account approval without current account consent and bounds anonymous requests", async () => {
    await db.insert(user).values({id: "agent-no-consent", name: "Synthetic", email: "agent-no-consent@example.test"});
    const pair = await beginPairing(db, "Needs consent", randomUUID());
    await expect(approvePairing(db, {id: "agent-no-consent", role: "member"}, pair.id, pair.userCode)).rejects.toThrow("правила");
    const fingerprint = randomUUID();
    for (let i = 0; i < 10; i++) await beginPairing(db, "Rate test", fingerprint);
    await expect(beginPairing(db, "Too many", fingerprint)).rejects.toThrow("много");
  });
});

describe("personal listing ownership", () => {
  it("enforces ownership on text, photos, editing and archive, including for an admin's personal agent", async () => {
    const connected = await connection();
    const fields = listingInput.parse({title: "Synthetic personal item", description: "Synthetic description, this is not an offer for sale.", category: "accessories", country: "RU", city: "Test city", price: "1250.50", condition: "used", contactUrl: "https://t.me/synthetic_test"});
    const foreignId = await createListing(db, bob, fields, [{storageKey: "synthetic-no-file", width: 100, height: 100}], acceptance);
    const ownId = await createListing(db, alice, fields, [{storageKey: "synthetic-own-no-file", width: 100, height: 100}], acceptance);
    expect((await (await handleMemberRequest(request(connected.token), ["listings"])).json()).items.map((item: {id: string}) => item.id)).toEqual([ownId]);
    for (const [method, path, body] of [
      ["GET", ["listings", foreignId], undefined],
      ["GET", ["listings", foreignId, "photos", randomUUID()], undefined],
      ["PATCH", ["listings", foreignId], {revision: 1}],
      ["POST", ["listings", foreignId, "archive"], {revision: 1}],
    ] as const) expect((await handleMemberRequest(request(connected.token, method, body), [...path])).status).toBe(404);
    expect((await handleMemberRequest(request(connected.token, "POST", {decision: "published", revision: 1}), ["listings", ownId])).status).toBe(404);
    const updated = await handleMemberRequest(request(connected.token, "PATCH", {revision: 1, acceptance, price: "1000.25"}), ["listings", ownId]);
    expect(updated.status).toBe(200);
    const after = await (await handleMemberRequest(request(connected.token), ["listings", ownId])).json();
    expect(after).toMatchObject({status: "pending", revision: 2, price: "1000.25"});
    expect(after).not.toHaveProperty("fullName");
    expect(after).not.toHaveProperty("email");
    expect((await handleMemberRequest(request(connected.token, "POST", {revision: 1}), ["listings", ownId, "archive"])).status).toBe(409);
    expect((await handleMemberRequest(request(connected.token, "POST", {revision: 2}), ["listings", ownId, "archive"])).status).toBe(200);
    expect((await handleMemberRequest(request(connected.token, "PATCH", {revision: 2, acceptance, price: "500"}), ["listings", ownId])).status).toBe(400);
  });
  it("cannot bypass per-listing consent, inject ownerId or publish immediately", async () => {
    const connected = await connection();
    const body = {title: "Synthetic personal item", description: "Synthetic description, not for sale.", category: "accessories", city: "Test city", country: "RU", price: "10", condition: "used", contactUrl: "https://t.me/synthetic_test", photos: [{dataBase64: "AA=="}]};
    for (const invalid of [body, {...body, acceptance, publish: true}, {...body, acceptance, ownerId: bob.id}, {...body, acceptance: {...acceptance, contact: false}}, {...body, acceptance: {...acceptance, version: "old"}}]) {
      expect((await handleMemberRequest(request(connected.token, "POST", invalid), ["listings"])).status).toBe(400);
    }
  });
});
