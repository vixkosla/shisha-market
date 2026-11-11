import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";

// Uses the same Drizzle migration journal/hash and database metadata as drizzle-kit.
// Only pg is needed in the standalone runtime; no dev dependencies are deployed.
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(43874387)");
  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await client.query('CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)');
  const { rows } = await client.query('SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1');
  const last = Number(rows[0]?.created_at ?? 0);
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
  for (const entry of journal.entries) {
    if (entry.when <= last) continue;
    const sql = readFileSync(`drizzle/${entry.tag}.sql`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.query(statement);
    }
    await client.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [createHash("sha256").update(sql).digest("hex"), entry.when]);
    console.info(`Applied ${entry.tag}`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
