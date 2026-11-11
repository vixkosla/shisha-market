import { z } from "zod";
import { DomainError, listingRevision } from "@/lib/listings";
import { getDatabase } from "@/server/db";
import { operatorActor } from "@/server/listings";
import { operatorAuthorized, operatorTokenConfigured } from "@/server/operator";
import { archiveOperatorListing } from "@/server/operator-listing";
import { OperatorRequestError, readOperatorJson } from "@/server/operator-api";

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  if (!operatorTokenConfigured()) return Response.json({error: "Not found"}, {status: 404});
  if (!operatorAuthorized(request)) return Response.json({error: "Unauthorized"}, {status: 401});
  const {id} = await params;
  try {
    if (!z.string().uuid().safeParse(id).success) throw new DomainError("Некорректный id.");
    const body = z.object({revision: listingRevision}).safeParse(await readOperatorJson(request));
    if (!body.success) throw new DomainError("Нужен актуальный revision из get_listing.");
    const db = await getDatabase();
    return Response.json(await archiveOperatorListing(db, await operatorActor(db), id, body.data.revision));
  } catch (error) {
    if (error instanceof DomainError) return Response.json({error: error.message}, {status: error instanceof OperatorRequestError ? error.status : 400});
    throw error;
  }
}
