import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { eq } from "drizzle-orm";
import { getDatabase } from "../src/server/db";
import { user } from "../src/server/db/schema";
const [email, role] = process.argv.slice(2);
if (!email || !["member", "moderator", "admin"].includes(role))
  throw new Error(
    "Usage: npm run user:role -- email@example.com moderator\nStop the dev server first when using PGlite. PostgreSQL can stay running.",
  );
const rows = await (
  await getDatabase()
)
  .update(user)
  .set({ role: role as "member" | "moderator" | "admin" })
  .where(eq(user.email, email.toLowerCase()))
  .returning();
if (!rows.length)
  throw new Error("No such user. Sign in once before assigning a role.");
console.info(`Role changed to ${role}.`);
process.exit(0);
