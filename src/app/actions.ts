"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { queueListingDecisionNotice, queueListingReviewNotice } from "@/server/listing-notifications";
import { requireUser } from "@/server/session";
import { getDatabase } from "@/server/db";
import {
  archiveListing,
  createListing,
  moderateListing,
  setFavorite,
} from "@/server/listings";
import { listingInput, DomainError } from "@/lib/listings";
import { deletePhoto, preparePhoto, storePhoto } from "@/server/storage";
import { and, eq, gte, count } from "drizzle-orm";
import { listings } from "@/server/db/schema";
import { publicationAcceptance, suggestionInput, supportInput } from "@/lib/legal";
import { assertListingPolicy } from "@/server/legal-policy";
import {
  submitRequest,
  resolveRequest,
  submitSuggestion,
  resolveSuggestion,
  suggestionFingerprint,
} from "@/server/support";
import { requireAccountAcceptance } from "@/server/legal-acceptance";
import { headers } from "next/headers";

export type ActionState = { error?: string; success?: string; createdId?: string };
export async function publishAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireUser("/listings/new");
  const parsed = listingInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const acceptance = publicationAcceptance.safeParse({
    version: form.get("legalVersion"),
    fullName: form.get("consentName"),
    personalItem: form.get("personalItem") === "on",
    adult: form.get("adult") === "on",
    contact: form.get("publishContact") === "on",
    city: form.get("publishCity") === "on",
    conditions: form.get("contactConditions") ?? "",
  });
  if (!acceptance.success) return { error: acceptance.error.issues[0].message };
  try {
    assertListingPolicy(parsed.data);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  const files = form
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length || files.length > 6)
    return { error: "Добавьте от 1 до 6 фотографий." };
  if (files.reduce((sum, file) => sum + file.size, 0) > 8 * 1024 * 1024)
    return { error: "Общий размер фотографий — до 8 МБ." };
  const db = await getDatabase();
  try {
    await requireAccountAcceptance(db, actor.id);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  const [recent] = await db
    .select({ total: count() })
    .from(listings)
    .where(
      and(
        eq(listings.ownerId, actor.id),
        gte(listings.createdAt, new Date(Date.now() - 86400000)),
      ),
    );
  if (recent.total >= 20) return { error: "Лимит — 20 объявлений в сутки." };
  const stored: string[] = [];
  let id: string;
  try {
    const images = [];
    for (const file of files) {
      const image = await preparePhoto(file);
      await storePhoto(image.storageKey, image.data);
      stored.push(image.storageKey);
      images.push({
        storageKey: image.storageKey,
        width: image.width,
        height: image.height,
      });
    }
    id = await createListing(db, actor, parsed.data, images, acceptance.data);
  } catch (error) {
    await Promise.allSettled(stored.map(deletePhoto));
    if (error instanceof DomainError) return { error: error.message };
    console.error("Listing creation failed", error);
    return { error: "Не удалось сохранить объявление. Попробуйте позже." };
  }
  revalidatePath("/account");
  queueListingReviewNotice(id);
  return { createdId: id };
}
export async function reviewAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireUser();
  const decision = form.get("decision");
  if (decision !== "published" && decision !== "rejected")
    return { error: "Некорректное решение." };
  try {
    await moderateListing(
      await getDatabase(),
      actor,
      String(form.get("id")),
      decision,
      String(form.get("note") ?? ""),
      Number(form.get("revision")),
    );
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  queueListingDecisionNotice(String(form.get("id")), decision, Number(form.get("revision")));
  revalidatePath("/", "layout");
  return {};
}
export async function favoriteAction(id: string, saved: boolean) {
  const actor = await requireUser();
  await setFavorite(await getDatabase(), actor, id, saved);
  revalidatePath("/", "layout");
}
export async function archiveAction(form: FormData) {
  const actor = await requireUser();
  await archiveListing(await getDatabase(), actor, String(form.get("id")));
  revalidatePath("/", "layout");
  redirect("/account");
}

export async function supportAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireUser();
  const input = supportInput.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: input.error.issues[0].message };
  try {
    const id = await submitRequest(await getDatabase(), actor, input.data);
    revalidatePath("/", "layout");
    return {
      success: `Обращение принято. Номер: ${id}.${input.data.kind === "withdraw" ? " Все ваши объявления сняты с публикации." : " Ответ появится в списке обращений."}`,
    };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}
export async function resolveSupportAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireUser();
  try {
    await resolveRequest(
      await getDatabase(),
      actor,
      String(form.get("id")),
      String(form.get("resolution") ?? ""),
      form.get("decision") === "hide",
    );
    revalidatePath("/", "layout");
    return { success: "Результат сохранён." };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export async function suggestionAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const input = suggestionInput.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: input.error.issues[0].message };
  const headerList = await headers();
  const fingerprint = suggestionFingerprint(
    headerList.get("x-forwarded-for")?.split(",")[0] ??
      headerList.get("x-real-ip") ??
      "",
    headerList.get("user-agent") ?? "",
  );
  try {
    const id = await submitSuggestion(
      await getDatabase(),
      input.data,
      fingerprint,
    );
    revalidatePath("/admin");
    return {
      success: `Предложение принято. Номер: ${id}. Ответ придёт на указанный контакт, если вы его оставили.`,
    };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export async function resolveSuggestionAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireUser();
  try {
    await resolveSuggestion(
      await getDatabase(),
      actor,
      String(form.get("id")),
      String(form.get("resolution") ?? ""),
    );
    revalidatePath("/admin");
    return { success: "Результат сохранён." };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}
