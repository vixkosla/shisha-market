import {and, desc, eq} from "drizzle-orm";
import {z} from "zod";
import {DomainError, keptPhotoIds, listingInput, listingRevision} from "@/lib/listings";
import {publicationAcceptance} from "@/lib/legal";
import {getDatabase} from "./db";
import {agentConnections, listings, photos, user} from "./db/schema";
import {agentActor, AgentError} from "./agent-auth";
import {inspectMemberListing, archiveMemberListing} from "./member-listings";
import {createListing, type PhotoInput} from "./listings";
import {updateListing} from "./listing-edit";
import {requireAccountAcceptance} from "./legal-acceptance";
import {assertListingPolicy} from "./legal-policy";
import {deletePhoto, preparePhoto, readPhoto, storePhoto} from "./storage";
import {decodeOperatorPhotos, operatorPhotoInput, OperatorRequestError, readOperatorJson} from "./operator-api";
import {queueListingReviewNotice} from "./listing-notifications";
import {appUrl} from "./auth";

const createInput = listingInput.extend({acceptance: publicationAcceptance, photos: z.array(operatorPhotoInput).min(1).max(6)}).strict();
const updateInput = listingInput.partial().extend({revision: listingRevision, acceptance: publicationAcceptance, keepPhotoIds: keptPhotoIds.optional(), photos: z.array(operatorPhotoInput).max(6).default([])}).strict();
const json = (body: unknown, status = 200) => Response.json(body, {status, headers: {"Cache-Control": "private, no-store"}});

export async function handleMemberRequest(request: Request, path: string[]) {
  const stored: string[] = [];
  let committed = false;
  try {
    const db = await getDatabase();
    const actor = await agentActor(db, request);
    const method = request.method;
    if (path.join("/") === "account" && method === "GET") {
      const [account] = await db.select({email: user.email}).from(user).where(eq(user.id, actor.id));
      return json({email: account?.email, role: "member", connectionId: actor.connectionId, manageUrl: `${appUrl()}/account/mcp`});
    }
    if (path.join("/") === "connection" && method === "DELETE") {
      await db.update(agentConnections).set({revokedAt: new Date()}).where(and(eq(agentConnections.id, actor.connectionId), eq(agentConnections.userId, actor.id)));
      return json({disconnected: true});
    }
    if (path[0] !== "listings") throw new AgentError("Not found", 404);
    const id = path[1];
    if (id && !z.string().uuid().safeParse(id).success) throw new AgentError("Некорректный id.");
    if (path.length === 1 && method === "GET") {
      const items = await db.select({id: listings.id, title: listings.title, city: listings.city, category: listings.category, status: listings.status, revision: listings.revision, createdAt: listings.createdAt, updatedAt: listings.updatedAt})
        .from(listings).where(eq(listings.ownerId, actor.id)).orderBy(desc(listings.createdAt)).limit(100);
      return json({items, limit: 100});
    }
    if (path.length === 2 && method === "GET") return json(await inspectMemberListing(db, actor, id));
    if (path.length === 4 && path[2] === "photos" && method === "GET") {
      await inspectMemberListing(db, actor, id);
      if (!z.string().uuid().safeParse(path[3]).success) throw new AgentError("Некорректный photoId.");
      const [photo] = await db.select({key: photos.storageKey}).from(photos).where(and(eq(photos.listingId, id), eq(photos.id, path[3])));
      if (!photo) throw new AgentError("Фото не найдено.", 404);
      return new Response(new Uint8Array(await readPhoto(photo.key)), {headers: {"Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}});
    }
    if (path.length === 3 && path[2] === "archive" && method === "POST") {
      const input = z.object({revision: listingRevision}).strict().safeParse(await readOperatorJson(request, 4096));
      if (!input.success) throw new AgentError("Укажите актуальный revision.");
      return json(await archiveMemberListing(db, actor, id, input.data.revision));
    }
    const prepareImages = async (files: {dataBase64: string}[]): Promise<PhotoInput[]> => {
      const result: PhotoInput[] = [];
      for (const raw of decodeOperatorPhotos(files)) {
        const image = await preparePhoto({size: raw.length, arrayBuffer: async () => raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)});
        stored.push(image.storageKey);
        await storePhoto(image.storageKey, image.data);
        result.push({storageKey: image.storageKey, width: image.width, height: image.height});
      }
      return result;
    };
    if (path.length === 1 && method === "POST") {
      const input = createInput.safeParse(await readOperatorJson(request));
      if (!input.success) throw new AgentError(input.error.issues[0].message);
      const {photos: files, acceptance, ...fields} = input.data;
      assertListingPolicy(fields);
      await requireAccountAcceptance(db, actor.id);
      const images = await prepareImages(files);
      const created = await createListing(db, actor, fields, images, acceptance);
      committed = true;
      queueListingReviewNotice(created);
      return json({id: created, status: "pending", revision: 1, url: `${appUrl()}/listings/${created}`}, 201);
    }
    if (path.length === 2 && method === "PATCH") {
      const current = await inspectMemberListing(db, actor, id);
      if (!current.canEdit) throw new AgentError("Снятое объявление нельзя восстановить через MCP.");
      const input = updateInput.safeParse(await readOperatorJson(request));
      if (!input.success) throw new AgentError(input.error.issues[0].message);
      if (current.revision !== input.data.revision) throw new AgentError("Объявление изменилось. Получите актуальный revision.", 409);
      const {photos: files, acceptance, keepPhotoIds, revision, ...changes} = input.data;
      // listingInput transforms price into kopecks; parse the complete raw price only once.
      const fields = listingInput.parse({...current, ...changes, price: Object.hasOwn(changes, "price") ? String(changes.price! / 100) : current.price});
      assertListingPolicy(fields);
      await requireAccountAcceptance(db, actor.id);
      const keep = keepPhotoIds ?? current.photos.map(photo => photo.id);
      if (keep.length + files.length < 1 || keep.length + files.length > 6 || new Set(keep).size !== keep.length || keep.some(photoId => !current.photos.some(photo => photo.id === photoId))) throw new AgentError("Оставьте 1–6 фотографий этого объявления.");
      const images = await prepareImages(files);
      const changed = await updateListing(db, actor, id, revision, fields, keep, images, acceptance);
      committed = true;
      const cleanup = await Promise.allSettled(changed.removedKeys.map(deletePhoto));
      if (cleanup.some(item => item.status === "rejected")) console.error("Member edit photo cleanup incomplete");
      queueListingReviewNotice(id, changed.revision);
      return json({id, status: "pending", revision: changed.revision, url: current.url});
    }
    throw new AgentError("Not found", 404);
  } catch (error) {
    if (!committed) await Promise.allSettled(stored.map(deletePhoto));
    if (error instanceof DomainError) return json({error: error.message}, error instanceof AgentError || error instanceof OperatorRequestError ? error.status : 400);
    if (error instanceof z.ZodError) return json({error: error.issues[0].message}, 400);
    console.error("Member API request failed");
    return json({error: "Не удалось выполнить действие. Проверьте список своих объявлений перед повторной отправкой."}, 500);
  }
}
