import { eq } from "drizzle-orm";
import { getDatabase } from "@/server/db";
import { listings, photos } from "@/server/db/schema";
import { currentUser } from "@/server/session";
import { canRead, isModerator } from "@/lib/listings";
import { LEGAL_VERSION } from "@/lib/legal";
import { listingMarketAllowed } from "@/server/legal-policy";
import { readPhoto } from "@/server/storage";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [photo] = await (
    await getDatabase()
  )
    .select({
      key: photos.storageKey,
      status: listings.status,
      owner: listings.ownerId,
      country: listings.country,
      category: listings.category,
      legalVersion: listings.legalVersion,
    })
    .from(photos)
    .innerJoin(listings, eq(listings.id, photos.listingId))
    .where(eq(photos.id, id));
  const publiclyAllowed =
    photo?.status === "published" &&
    photo.legalVersion === LEGAL_VERSION &&
    listingMarketAllowed(photo);
  const actor = publiclyAllowed ? null : await currentUser();
  if (
    !photo ||
    !canRead(photo.status, photo.owner, actor) ||
    (!publiclyAllowed &&
      photo.owner !== actor?.id &&
      !(actor && isModerator(actor)))
  )
    return new Response(null, { status: 404 });
  try {
    const bytes = await readPhoto(photo.key);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
