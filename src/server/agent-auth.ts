import {createHash, createHmac, randomBytes, randomUUID} from "node:crypto";
import {and, count, desc, eq, gt, isNull, lt, sql} from "drizzle-orm";
import type {Database} from "./db";
import {agentConnections, agentPairings, user} from "./db/schema";
import {DomainError, type Actor} from "@/lib/listings";
import {requireAccountAcceptance} from "./legal-acceptance";
import {authenticationEnabled} from "./auth-policy";
import {appUrl} from "./auth";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");
export class AgentError extends DomainError {
  constructor(message: string, public status = 400) {super(message);}
}
export function agentOriginAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(appUrl()).origin;
}
export function pairingFingerprint(request: Request) {
  // Caddy overwrites X-Forwarded-For; the application binds only to loopback.
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET || "local-development-only").update(address).digest("hex");
}
export async function beginPairing(db: Database, name: string, fingerprint: string) {
  if (!authenticationEnabled()) throw new AgentError("Вход временно недоступен.", 503);
  const normalized = name.trim();
  if (!normalized || normalized.length > 80 || /[\u0000-\u001f]/.test(normalized)) throw new AgentError("Название подключения: 1–80 символов.");
  const now = new Date();
  await db.delete(agentPairings).where(lt(agentPairings.expiresAt, new Date(+now - 86400000)));
  const [recent] = await db.select({total: count()}).from(agentPairings).where(and(eq(agentPairings.fingerprint, fingerprint), gt(agentPairings.createdAt, new Date(+now - 3600000))));
  if (recent.total >= 10) throw new AgentError("Слишком много запросов подключения. Повторите позже.", 429);
  const id = randomUUID(), deviceSecret = secret();
  const userCode = randomBytes(4).toString("hex").toUpperCase();
  const expiresAt = new Date(+now + 10 * 60000);
  await db.insert(agentPairings).values({id, secretHash: digest(deviceSecret), userCode, name: normalized, fingerprint, expiresAt});
  return {id, deviceSecret, userCode, verificationUrl: `${appUrl()}/account/mcp?request=${id}`, expiresAt: expiresAt.toISOString(), interval: 5};
}
export async function approvePairing(db: Database, actor: Actor, id: string, code: string) {
  await requireAccountAcceptance(db, actor.id);
  return db.transaction(async tx => {
    const [row] = await tx.select().from(agentPairings).where(eq(agentPairings.id, id)).for("update");
    if (!row || +row.expiresAt <= Date.now() || row.consumedAt || row.approvedAt || row.userCode !== code.trim().toUpperCase()) throw new AgentError("Запрос истёк, уже обработан или код не совпадает.");
    await tx.update(agentPairings).set({userId: actor.id, approvedAt: new Date()}).where(eq(agentPairings.id, id));
  });
}
export async function finishPairing(db: Database, id: string, deviceSecret: string) {
  if (!authenticationEnabled()) throw new AgentError("Вход временно недоступен.", 503);
  if (!/^[A-Za-z0-9_-]{43}$/.test(deviceSecret)) throw new AgentError("Неверный запрос подключения.", 401);
  return db.transaction(async tx => {
    const [row] = await tx.select().from(agentPairings).where(and(eq(agentPairings.id, id), eq(agentPairings.secretHash, digest(deviceSecret)))).for("update");
    if (!row || +row.expiresAt <= Date.now() || row.consumedAt) throw new AgentError("Подключение истекло или уже завершено. Начните новое.", 401);
    if (!row.userId || !row.approvedAt) return {status: "pending" as const};
    await tx.select({id: user.id}).from(user).where(eq(user.id, row.userId)).for("update");
    await requireAccountAcceptance(tx, row.userId);
    const [active] = await tx.select({total: count()}).from(agentConnections).where(and(eq(agentConnections.userId, row.userId), isNull(agentConnections.revokedAt), gt(agentConnections.expiresAt, new Date())));
    if (active.total >= 10) throw new AgentError("Уже подключено 10 агентов. Отзовите ненужное подключение в кабинете.");
    const token = `smu_${secret()}`, connectionId = randomUUID();
    const expiresAt = new Date(Date.now() + 90 * 86400000);
    await tx.insert(agentConnections).values({id: connectionId, userId: row.userId, name: row.name, tokenHash: digest(token), expiresAt});
    await tx.update(agentPairings).set({consumedAt: new Date()}).where(eq(agentPairings.id, id));
    return {status: "connected" as const, token, connectionId, expiresAt: expiresAt.toISOString()};
  });
}
export async function agentActor(db: Database, request: Request): Promise<Actor & {connectionId: string}> {
  if (!authenticationEnabled()) throw new AgentError("Вход временно недоступен.", 503);
  if (!agentOriginAllowed(request)) throw new AgentError("Недопустимый источник запроса.", 403);
  const header = request.headers.get("authorization") || "";
  if (!/^Bearer smu_[A-Za-z0-9_-]{43}$/.test(header)) throw new AgentError("Подключите свой аккаунт через connect_account.", 401);
  const [connection] = await db.select({id: agentConnections.id, userId: agentConnections.userId})
    .from(agentConnections).where(and(eq(agentConnections.tokenHash, digest(header.slice(7))), isNull(agentConnections.revokedAt), gt(agentConnections.expiresAt, new Date())));
  if (!connection) throw new AgentError("Доступ отозван или истёк. Подключите аккаунт заново.", 401);
  // A personal agent never inherits moderator/admin privileges, including its owner's.
  return {id: connection.userId, role: "member", connectionId: connection.id};
}
export async function listConnections(db: Database, userId: string) {
  return db.select({id: agentConnections.id, name: agentConnections.name, createdAt: agentConnections.createdAt, expiresAt: agentConnections.expiresAt, revokedAt: agentConnections.revokedAt, expired: sql<boolean>`${agentConnections.expiresAt} <= CURRENT_TIMESTAMP`})
    .from(agentConnections).where(eq(agentConnections.userId, userId)).orderBy(desc(agentConnections.createdAt)).limit(100);
}
export async function revokeConnection(db: Database, userId: string, id: string) {
  await db.update(agentConnections).set({revokedAt: new Date()}).where(and(eq(agentConnections.id, id), eq(agentConnections.userId, userId)));
}
