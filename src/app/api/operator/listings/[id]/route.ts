import { NextResponse } from "next/server";
import { DomainError, listingRevision } from "@/lib/listings";
import { getDatabase } from "@/server/db";
import { moderateListing, operatorActor } from "@/server/listings";
import { operatorAuthorized, operatorTokenConfigured } from "@/server/operator";
import { z } from "zod";
import { listingInput, keptPhotoIds } from "@/lib/listings";
import { inspectOperatorListing } from "@/server/operator-listing";
import { operatorPublicationAcceptance } from "@/server/listings";
import { decodeOperatorPhotos, operatorPhotoInput, OperatorRequestError, readOperatorJson } from "@/server/operator-api";
import { updateListing } from "@/server/listing-edit";
import { deletePhoto, preparePhoto, storePhoto } from "@/server/storage";
import { queueListingDecisionNotice, queueListingReviewNotice } from "@/server/listing-notifications";

function guard(request: Request) {
  if (!operatorTokenConfigured()) return NextResponse.json({error: "Not found"}, {status: 404});
  if (!operatorAuthorized(request)) return NextResponse.json({error: "Unauthorized"}, {status: 401});
}

export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  const failure = guard(request);
  if (failure) return failure;
  const {id} = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({error: "Некорректный id."}, {status: 400});
  try {
    const db = await getDatabase();
    const actor = await operatorActor(db);
    return NextResponse.json(await inspectOperatorListing(db, actor, id), {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({error: error.message}, {status: 400});
    throw error;
  }
}

const updateInput = z.object({revision: listingRevision, keepPhotoIds: keptPhotoIds.optional(), photos: z.array(operatorPhotoInput).max(6).default([])}).passthrough();

export async function PATCH(request: Request, context: {params: Promise<{id: string}>}) {
  const failure = guard(request);
  if (failure) return failure;
  const {id} = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({error: "Некорректный id."}, {status: 400});
  const stored: string[] = [];
  let committed = false;
  try {
    const body = updateInput.safeParse(await readOperatorJson(request));
    if (!body.success) throw new DomainError(body.error.issues[0].message);
    const db = await getDatabase();
    const actor = await operatorActor(db);
    const current = await inspectOperatorListing(db, actor, id);
    if (!current.canEdit) throw new DomainError("Можно исправлять только собственное активное объявление оператора.");
    if (current.revision !== body.data.revision) throw new DomainError("Объявление изменилось. Получите актуальную версию перед правкой.");
    const input = listingInput.safeParse({...current, ...Object.fromEntries(Object.keys(listingInput.shape).filter(key => Object.hasOwn(body.data, key)).map(key => [key, body.data[key]]))});
    if (!input.success) throw new DomainError(input.error.issues[0].message);
    const keep = body.data.keepPhotoIds ?? current.photos.map(photo => photo.id);
    if (keep.length + body.data.photos.length < 1 || keep.length + body.data.photos.length > 6) throw new DomainError("Оставьте от 1 до 6 фотографий.");
    const decoded = decodeOperatorPhotos(body.data.photos);
    const images = [];
    for (const raw of decoded) {
      const image = await preparePhoto({size: raw.length, arrayBuffer: async () => raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)});
      stored.push(image.storageKey);
      await storePhoto(image.storageKey, image.data);
      images.push({storageKey: image.storageKey, width: image.width, height: image.height});
    }
    const result = await updateListing(db, actor, id, body.data.revision, input.data, keep, images, operatorPublicationAcceptance());
    committed = true;
    const cleanup = await Promise.allSettled(result.removedKeys.map(deletePhoto));
    if (cleanup.some(result => result.status === "rejected")) console.error("Operator edit removed-media cleanup incomplete");
    queueListingReviewNotice(id, result.revision);
    return NextResponse.json({id, status: "pending", revision: result.revision, url: current.url});
  } catch (error) {
    if (!committed) await Promise.allSettled(stored.map(deletePhoto));
    if (error instanceof DomainError) return NextResponse.json({error: error.message}, {status: error instanceof OperatorRequestError ? error.status : 400});
    console.error("Operator edit failed");
    return NextResponse.json({error: "Не удалось сохранить изменения."}, {status: 500});
  }
}

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!operatorTokenConfigured())
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!operatorAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  let body: {
    decision?: string;
    note?: string;
    revision?: number;
  } | null;
  try { body = await readOperatorJson(request) as typeof body; } catch (error) {
    if (error instanceof OperatorRequestError) return NextResponse.json({error: error.message}, {status: error.status});
    throw error;
  }
  const decision = body?.decision;
  if (decision !== "published" && decision !== "rejected")
    return NextResponse.json({ error: "Некорректное решение." }, { status: 400 });
  const revision = listingRevision.safeParse(body?.revision);
  if (!revision.success)
    return NextResponse.json({ error: "Укажите revision из актуальной очереди проверки." }, { status: 400 });
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({error: "Некорректный id."}, {status: 400});
  if (body?.note !== undefined && typeof body.note !== "string") return NextResponse.json({error: "Комментарий должен быть строкой."}, {status: 400});
  try {
    const db = await getDatabase();
    const actor = await operatorActor(db);
    await moderateListing(db, actor, id, decision, String(body?.note ?? ""), revision.data);
    queueListingDecisionNotice(id, decision, revision.data);
    return NextResponse.json({ id, status: decision });
  } catch (error) {
    if (error instanceof DomainError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
