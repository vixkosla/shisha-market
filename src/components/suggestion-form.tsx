"use client";
import { useActionState } from "react";
import {
  suggestionAction,
  resolveSuggestionAction,
} from "@/app/actions";
import { Button } from "./ui/button";

export function SuggestionForm() {
  const [state, action, pending] = useActionState(suggestionAction, {});
  return (
    <form action={action} className="form-stack panel" id="suggest">
      <label>
        Предложение
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="Что добавить, упростить или поправить на площадке"
        />
      </label>
      <label>
        Контакт, если нужен ответ
        <input
          name="contact"
          maxLength={200}
          placeholder="Почта, VK или Telegram — по желанию"
        />
      </label>
      <p className="muted small">
        Форма для идей по площадке, не для объявлений и не для жалоб. Текст и
        указанный контакт увидит оператор. Это не приём правок исходного кода и
        не обещание внедрить каждое предложение.
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
        {pending ? "Отправляем…" : "Отправить предложение"}
      </Button>
    </form>
  );
}

export function ResolveSuggestionForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    resolveSuggestionAction,
    {},
  );
  return (
    <form action={action} className="form-stack">
      <input name="id" type="hidden" value={id} />
      <label>
        Ответ или пометка
        <textarea
          name="resolution"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
        />
      </label>
      <Button name="decision" value="close" disabled={pending}>
        Закрыть предложение
      </Button>
      {state.error && (
        <p role="alert" className="notice error">
          {state.error}
        </p>
      )}
    </form>
  );
}
