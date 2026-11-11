"use client";
import {useActionState} from "react";
import {connectionAction, type ConnectionState} from "@/app/account/mcp/actions";

export function AgentConnectionForm({id, revoke = false}: {id: string; revoke?: boolean}) {
  const [state, action, pending] = useActionState<ConnectionState, FormData>(connectionAction, {});
  if (state.success) return <p className="notice" role="status">{state.success}</p>;
  return <form action={action} className="form-stack">
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="action" value={revoke ? "revoke" : "approve"} />
    {!revoke && <>
      <label>Код от вашего агента<input name="code" required minLength={8} maxLength={8} autoComplete="off" placeholder="8 символов" /></label>
      <label className="check-label"><input type="checkbox" name="allow" required /><span>Разрешаю этому агенту работать с моими объявлениями. Доступ можно отозвать в кабинете.</span></label>
      <p className="muted small">Подтверждайте только подключение, которое начали сами. Агент не получает права модератора; согласие на публикацию контакта и города запрашивается для каждого объявления отдельно.</p>
    </>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <button type="submit" className={revoke ? "button button-secondary" : "button button-primary"} disabled={pending}>{pending ? "Сохраняем…" : revoke ? "Отозвать доступ" : "Подключить агента"}</button>
  </form>;
}
