import Link from "next/link";
import {eq, sql} from "drizzle-orm";
import {z} from "zod";
import {requireUser} from "@/server/session";
import {getDatabase} from "@/server/db";
import {agentPairings} from "@/server/db/schema";
import {listConnections} from "@/server/agent-auth";
import {AgentConnectionForm} from "@/components/agent-connection-form";

export const metadata = {title: "Мои ИИ-агенты", robots: {index: false, follow: false}};
export default async function AgentConnectionsPage({searchParams}: {searchParams: Promise<{request?: string}>}) {
  const query = await searchParams;
  const requestId = z.string().uuid().safeParse(query.request);
  const actor = await requireUser(`/account/mcp${requestId.success ? `?request=${requestId.data}` : ""}`);
  const db = await getDatabase();
  const [pairing] = requestId.success ? await db.select({id: agentPairings.id, name: agentPairings.name, expired: sql<boolean>`${agentPairings.expiresAt} <= CURRENT_TIMESTAMP`, approvedAt: agentPairings.approvedAt, consumedAt: agentPairings.consumedAt, userId: agentPairings.userId}).from(agentPairings).where(eq(agentPairings.id, requestId.data)) : [];
  const connections = await listConnections(db, actor.id);
  return <section className="narrow wide page-section legal-copy">
    <p className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</p><h1 className="page-title">Мои ИИ-агенты</h1>
    <p>Вы вошли как <strong>{actor.email}</strong>. Подключённый агент сможет создавать, читать, исправлять и снимать только ваши объявления. Публикации проходят обычную модерацию.</p>
    {query.request && <article className="panel">
      {!pairing || pairing.expired || (pairing.userId && pairing.userId !== actor.id) ? <p role="alert">Запрос недоступен или истёк. Начните подключение заново у своего агента.</p>
        : pairing.approvedAt ? <p role="status">Подключение «{pairing.name}» разрешено. {pairing.consumedAt ? "Агент уже получил доступ." : "Вернитесь к агенту и попросите завершить подключение."}</p>
        : <><h2>Подключить «{pairing.name}»</h2><p>Введите код, который показал ваш агент. Запрос действует 10 минут.</p><AgentConnectionForm id={pairing.id} /></>}
    </article>}
    <article className="panel"><h2>Как подключить</h2><p>Добавьте пользовательский MCP-клиент в своего помощника и попросите: «Подключи мой аккаунт Shisha Market». Агент даст ссылку для входа и код.</p><Link className="text-link" href="/mcp">Инструкция и файл подключения →</Link></article>
    <h2>Подключения</h2>
    {!connections.length && <p className="muted">Пока нет подключённых агентов.</p>}
    {connections.map(item => <article className="panel" key={item.id}>
      <h3>{item.name}</h3><p className="muted small">Подключён {item.createdAt.toLocaleDateString("ru-RU", {timeZone: "Europe/Moscow"})} · Доступ до {item.expiresAt.toLocaleDateString("ru-RU", {timeZone: "Europe/Moscow"})}</p>
      {item.revokedAt ? <p>Доступ отозван</p> : item.expired ? <p>Срок доступа истёк</p> : <AgentConnectionForm id={item.id} revoke />}
    </article>)}
    <Link className="text-link" href="/account">← Мои объявления</Link>
  </section>;
}
