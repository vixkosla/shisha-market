import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/server/db";
import { photos } from "@/server/db/schema";
import { operatorAuthorized, operatorTokenConfigured } from "@/server/operator";
import { operatorActor } from "@/server/listings";
import { readPhoto } from "@/server/storage";
import { DomainError } from "@/lib/listings";

export async function GET(request: Request, {params}: {params: Promise<{id: string; photoId: string}>}) {
  if (!operatorTokenConfigured()) return Response.json({error: "Not found"}, {status: 404});
  if (!operatorAuthorized(request)) return Response.json({error: "Unauthorized"}, {status: 401});
  const {id, photoId} = await params;
  if (![id, photoId].every(value => z.string().uuid().safeParse(value).success)) return Response.json({error: "Некорректный id."}, {status: 400});
  const db = await getDatabase();
  try { await operatorActor(db); }
  catch (error) {
    if (error instanceof DomainError) return Response.json({error: error.message}, {status: 400});
    throw error;
  }
  const [photo] = await db.select({key: photos.storageKey}).from(photos).where(and(eq(photos.listingId, id), eq(photos.id, photoId)));
  if (!photo) return new Response(null, {status: 404});
  try {
    return new Response(new Uint8Array(await readPhoto(photo.key)), {headers: {"Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}});
  } catch { return new Response(null, {status: 404}); }
}
