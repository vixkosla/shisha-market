import { sql } from "drizzle-orm";
import { getDatabase } from "@/server/db";
export async function GET() {
  try {
    await (await getDatabase()).execute(sql`select 1 from users limit 1`);
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
