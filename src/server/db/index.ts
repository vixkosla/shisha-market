import { PGlite } from "@electric-sql/pglite";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import { migrate as pgliteMigrate } from "drizzle-orm/pglite/migrator";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import path from "node:path";
import { mkdir } from "node:fs/promises";

export function createEmbeddedDatabase(client: PGlite) {
  return pgliteDrizzle(client, { schema });
}
export type Database =
  | ReturnType<typeof createEmbeddedDatabase>
  | ReturnType<typeof createPostgresDatabase>;
export function createPostgresDatabase(pool: Pool) {
  return pgDrizzle(pool, { schema });
}

async function connect(): Promise<Database> {
  const driver =
    process.env.DB_DRIVER ??
    (process.env.NODE_ENV === "production" ? "postgres" : "pglite");
  if (driver === "pglite") {
    if (process.env.NODE_ENV === "production")
      throw new Error(
        "PGlite is development-only. Configure PostgreSQL for production.",
      );
    const directory = path.resolve(
      /* turbopackIgnore: true */ process.env.PGLITE_PATH ?? ".data/postgres",
    );
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const db = createEmbeddedDatabase(new PGlite(directory));
    await pgliteMigrate(db, { migrationsFolder: path.resolve("drizzle") });
    return db;
  }
  if (driver !== "postgres" || !process.env.DATABASE_URL)
    throw new Error("Set DB_DRIVER=postgres and DATABASE_URL.");
  return createPostgresDatabase(
    new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }),
  );
}
const globalDb = globalThis as unknown as {
  shishaDatabase?: Promise<Database>;
};
export function getDatabase() {
  return (globalDb.shishaDatabase ??= connect().catch((error) => {
    globalDb.shishaDatabase = undefined;
    throw error;
  }));
}
