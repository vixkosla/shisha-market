import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL is required. Local PGlite migrates automatically during development.",
  );
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.info("PostgreSQL migrations applied.");
} finally {
  await pool.end();
}
