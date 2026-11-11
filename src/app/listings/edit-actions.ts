"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/app/actions";
import { DomainError, keptPhotoIds, listingInput, listingRevision } from "@/lib/listings";
import { publicationAcceptance } from "@/lib/legal";
import { getDatabase } from "@/server/db";
import { listings } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import { requireAccountAcceptance } from "@/server/legal-acceptance";
import { assertListingPolicy } from "@/server/legal-policy";
import { updateListing } from "@/server/listing-edit";
import { deletePhoto, preparePhoto, storePhoto } from "@/server/storage";
import { queueListingReviewNotice } from "@/server/listing-notifications";

export async function updateListingAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requireUser();
  const id = String(form.get("id") ?? "");
  const parsed = listingInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const revision = listingRevision.safeParse(Number(form.get("revision")));
  const kept = keptPhotoIds.safeParse(form.getAll("keepPhoto"));
  if (!revision.success || !kept.success) return { error: "Обновите страницу объявления и повторите отправку." };
  const acceptance = publicationAcceptance.safeParse({
    version: form.get("legalVersion"), fullName: form.get("consentName"),
    personalItem: form.get("personalItem") === "on", adult: form.get("adult") === "on",
    contact: form.get("publishContact") === "on", city: form.get("publishCity") === "on",
    conditions: form.get("contactConditions") ?? "",
  });
  if (!acceptance.success) return { error: acceptance.error.issues[0].message };
  const files = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  if (kept.data.length + files.length < 1 || kept.data.length + files.length > 6)
    return { error: "Оставьте от 1 до 6 фотографий вместе с новыми." };
  if (files.reduce((sum, file) => sum + file.size, 0) > 8 * 1024 * 1024)
    return { error: "Общий размер новых фотографий — до 8 МБ." };
  const db = await getDatabase();
  const stored: string[] = [];
  let removed: string[];
  try {
    // Reject unauthorized requests before spending storage/processing resources.
    const [item] = await db.select().from(listings)
      .where(and(eq(listings.id, id), eq(listings.ownerId, actor.id)));
    if (!item) throw new DomainError("Объявление не найдено.");
    if (item.status === "archived") throw new DomainError("Объявление снято с публикации. Обратитесь в поддержку.");
    if (item.revision !== revision.data)
      throw new DomainError("Объявление уже изменено в другой вкладке. Скопируйте правки и откройте актуальную версию.");
    assertListingPolicy(parsed.data);
    await requireAccountAcceptance(db, actor.id);
    const images = [];
    for (const file of files) {
      const image = await preparePhoto(file);
      // Include even a failed upload: a remote store may have written before timing out.
      stored.push(image.storageKey);
      await storePhoto(image.storageKey, image.data);
      images.push({ storageKey: image.storageKey, width: image.width, height: image.height });
    }
    const result = await updateListing(db, actor, id, revision.data, parsed.data, kept.data, images, acceptance.data);
    removed = result.removedKeys;
  } catch (error) {
    const cleanup = await Promise.allSettled(stored.map((key) => deletePhoto(key)));
    if (cleanup.some((result) => result.status === "rejected"))
      console.error("Listing edit upload cleanup incomplete");
    const message = error instanceof DomainError ? error.message : "Не удалось сохранить изменения. Попробуйте позже.";
    if (!(error instanceof DomainError)) console.error("Listing edit failed");
    return { error: message };
  }
  // Never roll back a committed edit because cleanup failed. Removed media IDs are
  // already unreachable; storage-orphan cleanup can be retried operationally.
  const cleanup = await Promise.allSettled(removed.map((key) => deletePhoto(key)));
  if (cleanup.some((result) => result.status === "rejected"))
    console.error("Listing edit removed-media cleanup incomplete");
  revalidatePath("/", "layout");
  queueListingReviewNotice(id, revision.data + 1);
  redirect(`/listings/${id}`);
}
