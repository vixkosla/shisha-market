import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, count, eq, gte } from "drizzle-orm";
import { DomainError, isModerator, type Actor } from "@/lib/listings";
import {
  supportInput,
  suggestionInput,
  type SupportInput,
  type SuggestionInput,
  LEGAL_VERSION,
} from "@/lib/legal";
import type { Database } from "./db";
import {
  legalAcceptances,
  listings,
  moderationEvents,
  suggestions,
  supportRequests,
  user,
} from "./db/schema";
import { legalConfiguration } from "./legal-policy";

export async function submitRequest(
  db: Database,
  actor: Actor,
  input: SupportInput,
) {
  const parsed = supportInput.safeParse(input);
  if (!parsed.success) throw new DomainError(parsed.error.issues[0].message);
  const data = parsed.data;
  const id = randomUUID();
  await db.transaction(async (tx) => {
    const [account] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, actor.id))
      .for("update");
    if (!account) throw new DomainError("Сначала войдите в аккаунт.");
    const [recent] = await tx
      .select({ total: count() })
      .from(supportRequests)
      .where(
        and(
          eq(supportRequests.userId, actor.id),
          gte(supportRequests.createdAt, new Date(Date.now() - 86400000)),
        ),
      );
    if (recent.total >= 20 && data.kind !== "withdraw")
      throw new DomainError(
        "Лимит обращений на сегодня исчерпан. Для срочного обращения используйте email оператора.",
      );
    if (data.listingId) {
      const [item] = await tx
        .select()
        .from(listings)
        .where(eq(listings.id, data.listingId));
      if (
        !item ||
        (item.status !== "published" &&
          item.ownerId !== actor.id &&
          !isModerator(actor))
      )
        throw new DomainError("Объявление недоступно.");
    }
    await tx.insert(supportRequests).values({
      id,
      userId: actor.id,
      listingId: data.listingId || null,
      kind: data.kind,
      message: data.message,
    });
    if (data.kind === "withdraw") {
      await tx
        .update(listings)
        .set({ status: "archived" })
        .where(eq(listings.ownerId, actor.id));
      await tx.insert(legalAcceptances).values({
        id: randomUUID(),
        userId: actor.id,
        kind: "publication-withdrawal",
        version: LEGAL_VERSION,
        evidence: { requestId: id, scope: "all-own-listings" },
      });
    }
  });
  return id;
}

export async function requestsFor(db: Database, actor: Actor, queue = false) {
  if (queue && !isModerator(actor)) throw new DomainError("Недостаточно прав.");
  return db
    .select()
    .from(supportRequests)
    .where(
      queue
        ? eq(supportRequests.status, "open")
        : eq(supportRequests.userId, actor.id),
    )
    .orderBy(
      queue ? asc(supportRequests.createdAt) : desc(supportRequests.createdAt),
      queue ? asc(supportRequests.id) : desc(supportRequests.id),
    )
    .limit(100);
}

export async function resolveRequest(
  db: Database,
  actor: Actor,
  id: string,
  resolution: string,
  hide: boolean,
) {
  if (!isModerator(actor)) throw new DomainError("Недостаточно прав.");
  if (resolution.trim().length < 10 || resolution.length > 2000)
    throw new DomainError("Укажите результат рассмотрения (10–2000 символов).");
  await db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(supportRequests)
      .where(eq(supportRequests.id, id))
      .for("update");
    if (!request || request.status !== "open")
      throw new DomainError("Обращение уже рассмотрено или не найдено.");
    if (hide) {
      if (!request.listingId)
        throw new DomainError("У обращения нет связанного объявления.");
      const [hidden] = await tx
        .update(listings)
        .set({
          status: "archived",
          moderationNote:
            "Публикация снята модератором по результатам обращения.",
        })
        .where(eq(listings.id, request.listingId)).returning();
      await tx.insert(moderationEvents).values({
        id: randomUUID(),
        listingId: request.listingId,
        actorId: actor.id,
        decision: "archived",
        listingRevision: hidden.revision,
        note: `Обращение ${id}; подробности в закрытой очереди.`,
      });
    }
    // Resolving a request is not a claim that account deletion is automatic.
    await tx
      .update(supportRequests)
      .set({
        status: "resolved",
        resolution: resolution.trim(),
        reviewerId: actor.id,
        resolvedAt: new Date(),
      })
      .where(eq(supportRequests.id, id));
  });
}

export function suggestionFingerprint(ip: string, userAgent: string) {
  return createHash("sha256")
    .update(`${ip.trim()}|${userAgent.slice(0, 300)}`)
    .digest("hex");
}

async function notifyOperator(subject: string, text: string) {
  const to = legalConfiguration().email;
  if (!to) return;
  if ((process.env.MAIL_MODE ?? "console") === "console") {
    if (process.env.NODE_ENV === "production") return;
    console.info(`[LOCAL EMAIL ONLY] ${to}: ${subject}\n${text}`);
    return;
  }
  if (process.env.SMTP_HOST === "smtp.resend.com" && process.env.SMTP_PASSWORD) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SMTP_PASSWORD}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [to],
        subject,
        text,
      }),
    });
  }
}

export async function submitSuggestion(
  db: Database,
  input: SuggestionInput,
  fingerprint: string,
) {
  const parsed = suggestionInput.safeParse(input);
  if (!parsed.success) throw new DomainError(parsed.error.issues[0].message);
  const id = randomUUID();
  await db.transaction(async (tx) => {
    const [recent] = await tx
      .select({ total: count() })
      .from(suggestions)
      .where(
        and(
          eq(suggestions.fingerprint, fingerprint),
          gte(suggestions.createdAt, new Date(Date.now() - 86400000)),
        ),
      );
    if (fingerprint && recent.total >= 5)
      throw new DomainError(
        "Сегодня уже отправлено несколько предложений. Напишите на почту оператора, если срочно.",
      );
    await tx.insert(suggestions).values({
      id,
      contact: parsed.data.contact,
      message: parsed.data.message,
      fingerprint,
    });
  });
  await notifyOperator(
    "Предложение для Shisha Market",
    `${parsed.data.message}\n\nКонтакт: ${parsed.data.contact || "не указан"}\nНомер: ${id}`,
  ).catch(() => undefined);
  return id;
}

export async function suggestionsFor(db: Database, actor: Actor) {
  if (!isModerator(actor)) throw new DomainError("Недостаточно прав.");
  return db
    .select()
    .from(suggestions)
    .where(eq(suggestions.status, "open"))
    .orderBy(asc(suggestions.createdAt), asc(suggestions.id))
    .limit(100);
}

export async function resolveSuggestion(
  db: Database,
  actor: Actor,
  id: string,
  resolution: string,
) {
  if (!isModerator(actor)) throw new DomainError("Недостаточно прав.");
  if (resolution.trim().length < 10 || resolution.length > 2000)
    throw new DomainError("Укажите результат рассмотрения (10–2000 символов).");
  const [row] = await db
    .select()
    .from(suggestions)
    .where(eq(suggestions.id, id));
  if (!row || row.status !== "open")
    throw new DomainError("Предложение уже рассмотрено или не найдено.");
  await db
    .update(suggestions)
    .set({
      status: "resolved",
      resolution: resolution.trim(),
      reviewerId: actor.id,
      resolvedAt: new Date(),
    })
    .where(eq(suggestions.id, id));
}
