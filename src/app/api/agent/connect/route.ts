import {z} from "zod";
import {getDatabase} from "@/server/db";
import {AgentError, agentOriginAllowed, beginPairing, pairingFingerprint} from "@/server/agent-auth";
import {readOperatorJson, OperatorRequestError} from "@/server/operator-api";
import {DomainError} from "@/lib/listings";

export async function POST(request: Request) {
  try {
    if (!agentOriginAllowed(request)) throw new AgentError("Недопустимый источник запроса.", 403);
    const input = z.object({name: z.string().min(1).max(80)}).strict().safeParse(await readOperatorJson(request, 4096));
    if (!input.success) throw new AgentError("Укажите название подключения.");
    return Response.json(await beginPairing(await getDatabase(), input.data.name, pairingFingerprint(request)), {headers: {"Cache-Control": "no-store"}});
  } catch (error) {
    if (error instanceof DomainError) return Response.json({error: error.message}, {status: error instanceof AgentError || error instanceof OperatorRequestError ? error.status : 400, headers: {"Cache-Control": "no-store"}});
    console.error("Agent connection failed");
    return Response.json({error: "Не удалось начать подключение."}, {status: 500});
  }
}
