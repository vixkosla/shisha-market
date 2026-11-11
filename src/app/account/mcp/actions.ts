"use server";
import {headers} from "next/headers";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {requireUser} from "@/server/session";
import {getDatabase} from "@/server/db";
import {approvePairing, revokeConnection} from "@/server/agent-auth";
import {appUrl} from "@/server/auth";
import {DomainError} from "@/lib/listings";

export type ConnectionState = {error?: string; success?: string};
export async function connectionAction(_previous: ConnectionState, form: FormData): Promise<ConnectionState> {
  const h = await headers();
  if (h.get("origin") !== new URL(appUrl()).origin) return {error: "Обновите страницу подключения."};
  const actor = await requireUser("/account/mcp");
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return {error: "Некорректный запрос."};
  try {
    const db = await getDatabase();
    if (form.get("action") === "approve") {
      if (form.get("allow") !== "on") return {error: "Подтвердите доступ вашего агента."};
      await approvePairing(db, actor, id.data, String(form.get("code") || ""));
      revalidatePath("/account/mcp");
      return {success: "Доступ разрешён. Вернитесь к своему агенту и попросите завершить подключение."};
    }
    if (form.get("action") === "revoke") {
      await revokeConnection(db, actor.id, id.data);
      revalidatePath("/account/mcp");
      return {success: "Доступ этого агента отозван."};
    }
    return {error: "Неизвестное действие."};
  } catch (error) {
    if (error instanceof DomainError) return {error: error.message};
    console.error("Agent connection account action failed");
    return {error: "Не удалось изменить подключение."};
  }
}
