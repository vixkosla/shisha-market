"use client";
import { useActionState } from "react";
import { resolveSupportAction, supportAction } from "@/app/actions";
import { requestKinds } from "@/lib/legal";
import { Button } from "./ui/button";

export function SupportForm({ listingId = "" }: { listingId?: string }) {
  const [state, action, pending] = useActionState(supportAction, {});
  return (
    <form action={action} className="form-stack panel">
      <label>
        Тип обращения
        <select name="kind" defaultValue={listingId ? "report" : "access"}>
          {Object.entries(requestKinds).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Идентификатор объявления
        <input name="listingId" defaultValue={listingId} maxLength={36} />
        <span className="muted small">
          Обязателен для жалобы; для запроса о своём аккаунте оставьте пустым.
        </span>
      </label>
      <label>
        Суть обращения
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
        />
      </label>
      <p className="muted small">
        Обращение видите только вы и модераторы. Не прикладывайте паспорт и
        платёжные данные. Отзыв согласия на публикацию сразу скроет все ваши
        объявления. Запрос удаления аккаунта требует отдельной обработки
        оператором.
      </p>
      {state.error && (
        <p role="alert" className="notice error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="notice">
          {state.success}
        </p>
      )}
      <Button disabled={pending}>
        {pending ? "Отправляем…" : "Отправить обращение"}
      </Button>
    </form>
  );
}
export function ResolveSupportForm({
  id,
  listing,
}: {
  id: string;
  listing: boolean;
}) {
  const [state, action, pending] = useActionState(resolveSupportAction, {});
  return (
    <form action={action} className="form-stack">
      <input name="id" type="hidden" value={id} />
      <label>
        Ответ заявителю
        <textarea
          name="resolution"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
        />
      </label>
      <p className="muted small">
        Ответ увидит заявитель. Не сообщайте чужие данные. Закрытие обращения не
        удаляет аккаунт: сначала выполните и проверьте требуемое действие.
      </p>
      <div className="actions">
        <Button name="decision" value="close" disabled={pending}>
          Ответить и закрыть
        </Button>
        {listing && (
          <Button
            name="decision"
            value="hide"
            variant="outline"
            disabled={pending}
          >
            Снять публикацию и закрыть
          </Button>
        )}
      </div>
      {state.error && (
        <p role="alert" className="notice error">
          {state.error}
        </p>
      )}
    </form>
  );
}
