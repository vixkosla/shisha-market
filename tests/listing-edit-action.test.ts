import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { LEGAL_VERSION } from "@/lib/legal";
import { DomainError } from "@/lib/listings";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), getDatabase: vi.fn(), select: vi.fn(), requireAccount: vi.fn(),
  update: vi.fn(), prepare: vi.fn(), store: vi.fn(), remove: vi.fn(),
  revalidate: vi.fn(), redirect: vi.fn(),
}));
vi.mock("@/server/session", () => ({requireUser: mocks.requireUser}));
vi.mock("@/server/db", () => ({getDatabase: mocks.getDatabase}));
vi.mock("@/server/legal-acceptance", () => ({requireAccountAcceptance: mocks.requireAccount}));
vi.mock("@/server/listing-edit", () => ({updateListing: mocks.update}));
vi.mock("@/server/storage", () => ({preparePhoto: mocks.prepare, storePhoto: mocks.store, deletePhoto: mocks.remove}));
vi.mock("next/cache", () => ({revalidatePath: mocks.revalidate}));
vi.mock("next/navigation", () => ({redirect: mocks.redirect}));
import { updateListingAction } from "@/app/listings/edit-actions";
vi.mock("@/server/listing-notifications", () => ({queueListingReviewNotice: vi.fn(), queueListingDecisionNotice: vi.fn()}));

const photoId = "70f97440-9036-4b9e-b8cf-1fc2b682cf1a";
const image = (key: string) => ({storageKey: key, data: Buffer.from("synthetic"), width: 100, height: 100});
const db = {select: () => ({from: () => ({where: mocks.select})})};
function form(fileCount = 0) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    id: "synthetic-listing", revision: "1", title: "Синтетическая тестовая чаша",
    description: "Синтетическое описание для проверки обработки ошибок, не предложение продажи.",
    category: "bowls", country: "RU", city: "Москва", price: "2500,50", condition: "used",
    contactUrl: "https://vk.ru/edit_test", keepPhoto: photoId, legalVersion: LEGAL_VERSION,
    consentName: "Синтетический Автор", personalItem: "on", adult: "on", publishContact: "on", publishCity: "on",
  })) data.set(key, value);
  for (let i = 0; i < fileCount; i++) data.append("photos", new File(["synthetic"], `photo-${i}.png`, {type: "image/png"}));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.requireUser.mockResolvedValue({id: "owner", role: "member"});
  mocks.getDatabase.mockResolvedValue(db);
  mocks.select.mockResolvedValue([{id: "synthetic-listing", ownerId: "owner", status: "published", revision: 1}]);
  mocks.requireAccount.mockResolvedValue(undefined);
  mocks.prepare.mockResolvedValueOnce(image("new-1.webp")).mockResolvedValueOnce(image("new-2.webp"));
  mocks.store.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
  mocks.update.mockResolvedValue({revision: 2, removedKeys: []});
  mocks.redirect.mockImplementation(() => {throw new Error("NEXT_REDIRECT");});
});
afterEach(() => vi.restoreAllMocks());

describe("editing action storage boundaries", () => {
  it("retains existing images on a text-only edit and revalidates only after commit", async () => {
    await expect(updateListingAction({}, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(db, {id: "owner", role: "member"}, "synthetic-listing", 1, expect.objectContaining({price: 250050}), [photoId], [], expect.objectContaining({version: LEGAL_VERSION}));
    expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });
  it("does not process uploads for a non-owner", async () => {
    mocks.select.mockResolvedValue([]);
    expect(await updateListingAction({}, form(1))).toEqual({error: expect.stringContaining("не найдено")});
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("removes a staged upload if the next photograph is invalid", async () => {
    mocks.prepare.mockReset().mockResolvedValueOnce(image("new-1.webp")).mockRejectedValueOnce(new DomainError("Неверное фото"));
    expect(await updateListingAction({}, form(2))).toEqual({error: "Неверное фото"});
    expect(mocks.remove.mock.calls).toEqual([["new-1.webp"]]);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("cleans up both uploads when storage fails midway", async () => {
    mocks.store.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("storage unavailable"));
    expect(await updateListingAction({}, form(2))).toEqual({error: expect.stringContaining("Не удалось сохранить")});
    expect(mocks.remove.mock.calls).toEqual([["new-1.webp"], ["new-2.webp"]]);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("cleans up new uploads, not old media, if the transaction rejects a concurrent edit", async () => {
    mocks.update.mockRejectedValue(new DomainError("Изменено в другой вкладке"));
    expect(await updateListingAction({}, form(2))).toEqual({error: expect.stringContaining("другой вкладке")});
    expect(mocks.remove.mock.calls).toEqual([["new-1.webp"], ["new-2.webp"]]);
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("does not report a failed save or remove new media when post-commit cleanup fails", async () => {
    mocks.update.mockResolvedValue({revision: 2, removedKeys: ["obsolete.webp"]});
    mocks.remove.mockRejectedValue(new Error("storage unavailable"));
    await expect(updateListingAction({}, form(1))).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.remove.mock.calls).toEqual([["obsolete.webp"]]);
    expect(mocks.revalidate).toHaveBeenCalled();
  });
  it("requires a fresh explicit publication consent", async () => {
    const data = form(1);
    data.delete("publishContact");
    expect((await updateListingAction({}, data)).error).toBeTruthy();
    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
