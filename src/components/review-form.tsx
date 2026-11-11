"use client";
import { useActionState } from "react";
import { reviewAction } from "@/app/actions";
import { Button } from "./ui/button";
export function ReviewForm({ id, revision }: { id: string; revision: number }) {
  const [state, action, pending] = useActionState(reviewAction, {});
  return (
    <form action={action} className="form-stack">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="revision" value={revision} />
      <label>
        Комментарий модератора
        <textarea
          name="note"
          maxLength={1000}
          rows={2}
          placeholder="Причина обязательна при отклонении"
        />
      </label>
      <div className="actions">
        <Button name="decision" value="published" disabled={pending}>
          Одобрить
        </Button>
        <Button
          name="decision"
          value="rejected"
          variant="outline"
          disabled={pending}
        >
          Отклонить
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="notice error">
          {state.error}
        </p>
      )}
    </form>
  );
}
