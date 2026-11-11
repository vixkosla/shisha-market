import {z} from "zod";
import {getDatabase} from "@/server/db";
import {AgentError, agentOriginAllowed, finishPairing} from "@/server/agent-auth";
import {readOperatorJson, OperatorRequestError} from "@/server/operator-api";
import {DomainError} from "@/lib/listings";

export async function POST(request: Request) {
  try {
    if (!agentOriginAllowed(request)) throw new AgentError("Недопустимый источник запроса.", 403);
    const input = z.object({id: z.string().uuid(), deviceSecret: z.string().length(43)}).strict().safeParse(await readOperatorJson(request, 4096));
    if (!input.success) throw new AgentError("Некорректный запрос подключения.");
    return Response.json(await finishPairing(await getDatabase(), input.data.id, input.data.deviceSecret), {headers: {"Cache-Control": "no-store"}});
  } catch (error) {
    if (error instanceof DomainError) return Response.json({error: error.message}, {status: error instanceof AgentError || error instanceof OperatorRequestError ? error.status : 400, headers: {"Cache-Control": "no-store"}});
    console.error("Agent authorization failed");
    return Response.json({error: "Не удалось завершить подключение."}, {status: 500});
  }
}
