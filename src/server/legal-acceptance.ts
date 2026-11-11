import { and, eq, inArray } from "drizzle-orm";
import { LEGAL_VERSION } from "@/lib/legal";
import { DomainError } from "@/lib/listings";
import type { Database } from "./db";
import { legalAcceptances } from "./db/schema";

export async function hasCurrentAccountAcceptance(
  db: Pick<Database, "selectDistinct">,
  userId: string,
) {
  const records = await db
    .selectDistinct({ kind: legalAcceptances.kind })
    .from(legalAcceptances)
    .where(
      and(
        eq(legalAcceptances.userId, userId),
        eq(legalAcceptances.version, LEGAL_VERSION),
        inArray(legalAcceptances.kind, ["terms", "processing"]),
      ),
    );
  return records.length === 2;
}
export async function requireAccountAcceptance(db: Pick<Database, "selectDistinct">, userId: string) {
  if (!(await hasCurrentAccountAcceptance(db, userId)))
    throw new DomainError(
      "Для публикации подтвердите вход заново и примите актуальные правила и согласие на обработку данных.",
    );
}
