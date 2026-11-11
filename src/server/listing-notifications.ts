import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "./db";
import { listings, user } from "./db/schema";
import { legalConfiguration } from "./legal-policy";
import { sendServiceEmail } from "./service-mail";

function schedule(id: string, revision: number, decision?: "published" | "rejected") {
  const deliver = async () => {
    try {
      const [item] = await (await getDatabase()).select({email: user.email, status: listings.status, revision: listings.revision})
        .from(listings).innerJoin(user, eq(user.id, listings.ownerId)).where(and(eq(listings.id, id), eq(listings.revision, revision)));
      const config = legalConfiguration();
      if (!item || item.status !== (decision ?? "pending") || item.email.toLowerCase() === config.email.toLowerCase()) return;
      const origin = config.siteUrl.replace(/\/$/, "");
      // No author name, contact link, photos or private description in email.
      await sendServiceEmail(decision ? item.email : config.email,
        decision ? "Результат проверки объявления Shisha Market" : "Объявление Shisha Market ожидает проверки",
        decision
          ? `Объявление ${id}, версия ${revision}: ${decision === "published" ? "опубликовано" : "нужны исправления"}.\nОткройте карточку, чтобы увидеть статус и комментарий модератора:\n${origin}/listings/${id}\nМои объявления: ${origin}/account\nЭто служебное сообщение, не реклама.`
          : `В очереди новое или исправленное объявление.\nID: ${id}\nВерсия: ${revision}\nОчередь проверки: ${origin}/admin\nКарточка (нужен вход модератора): ${origin}/listings/${id}`,
        `listing-${id}-r${revision}-${decision ?? "pending"}`,
      );
    } catch {
      // The database queue remains authoritative; email is best effort, not an outbox.
      console.error(`Listing notification failed for ${id}, revision ${revision}`);
    }
  };
  try { after(deliver); } catch { console.error(`Listing notification scheduling failed for ${id}, revision ${revision}`); }
}

export function queueListingReviewNotice(id: string, revision = 1) { schedule(id, revision); }
export function queueListingDecisionNotice(id: string, decision: "published" | "rejected", revision: number) { schedule(id, revision, decision); }
