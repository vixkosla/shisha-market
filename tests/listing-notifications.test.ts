import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({after: vi.fn(), select: vi.fn(), mail: vi.fn()}));
vi.mock("next/server", () => ({after: mocks.after}));
vi.mock("@/server/db", () => ({getDatabase: async () => ({select: () => ({from: () => ({innerJoin: () => ({where: mocks.select})})})})}));
vi.mock("@/server/legal-policy", () => ({legalConfiguration: () => ({email: "operator@example.test", siteUrl: "https://market.example.test/"})}));
vi.mock("@/server/service-mail", () => ({sendServiceEmail: mocks.mail}));
import {queueListingDecisionNotice, queueListingReviewNotice} from "@/server/listing-notifications";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.select.mockResolvedValue([{email: "author@example.test", status: "pending", revision: 2}]);
  mocks.mail.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());
async function deliver() {await mocks.after.mock.calls[0][0]();}

describe("best effort service notifications", () => {
  it("defers the moderator email and includes only IDs and authenticated links", async () => {
    queueListingReviewNotice("synthetic-id", 2);
    expect(mocks.mail).not.toHaveBeenCalled();
    await deliver();
    expect(mocks.mail).toHaveBeenCalledWith("operator@example.test", expect.any(String), expect.stringContaining("https://market.example.test/admin"), "listing-synthetic-id-r2-pending");
    expect(mocks.mail.mock.calls[0][2]).not.toContain("author@example.test");
  });
  it("emails the author the result without private content or a rejection note", async () => {
    mocks.select.mockResolvedValue([{email: "author@example.test", status: "rejected", revision: 2}]);
    queueListingDecisionNotice("synthetic-id", "rejected", 2);
    await deliver();
    expect(mocks.mail).toHaveBeenCalledWith("author@example.test", expect.any(String), expect.stringContaining("нужны исправления"), "listing-synthetic-id-r2-rejected");
    expect(mocks.mail.mock.calls[0][2]).toContain("/listings/synthetic-id");
  });
  it.each([[], [{email: "author@example.test", status: "archived", revision: 2}], [{email: "OPERATOR@example.test", status: "pending", revision: 2}]])("skips absent, changed and operator-owned records", async (...rows) => {
    mocks.select.mockResolvedValue(rows);
    queueListingReviewNotice("synthetic-id", 2);
    await deliver();
    expect(mocks.mail).not.toHaveBeenCalled();
  });
  it("does not undo a save when scheduling or transport fails", async () => {
    mocks.after.mockImplementationOnce(() => {throw new Error("no request context");});
    expect(() => queueListingReviewNotice("synthetic-id", 2)).not.toThrow();
    mocks.after.mockReset();
    mocks.mail.mockRejectedValue(new Error("transport failed"));
    queueListingReviewNotice("synthetic-id", 2);
    await expect(deliver()).resolves.toBeUndefined();
  });
});
