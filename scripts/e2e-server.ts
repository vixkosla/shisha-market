import { mkdtemp, mkdir, appendFile, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import sharp from "sharp";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createEmbeddedDatabase } from "../src/server/db";
import { legalAcceptances, listings, photos, user } from "../src/server/db/schema";
import { LEGAL_VERSION } from "../src/lib/legal";
import { EXAMPLE_LISTING_IDS } from "../src/lib/listing-examples";

const directory = await mkdtemp(join(tmpdir(), "shisha-e2e-"));
await mkdir(".data", { recursive: true, mode: 0o700 });
const client = new PGlite(join(directory, "postgres"));
const db = createEmbeddedDatabase(client);
await migrate(db, { migrationsFolder: "drizzle" });
await db.insert(user).values({
  id: "e2e-moderator",
  email: "moderator@e2e.example.test",
  emailVerified: true,
  name: "Test moderator",
  role: "moderator",
});
await db.insert(user).values({id: "e2e-operator", email: "hello@shisha-market.com", emailVerified: true, name: "Synthetic operator", role: "admin"});
await db.insert(legalAcceptances).values(["terms", "processing"].map(kind => ({id: `e2e-operator-${kind}`, userId: "e2e-operator", kind, version: LEGAL_VERSION, evidence: {synthetic: true}})));
// Synthetic launch-example fixture in this temporary database only. No production writes.
await mkdir(join(directory, "uploads"));
const examplePhotoKey = `${randomUUID()}.webp`;
await writeFile(join(directory, "uploads", examplePhotoKey), await sharp({create: {width: 600, height: 480, channels: 3, background: "#d4d6c8"}}).webp().toBuffer());
await db.insert(listings).values({
  id: EXAMPLE_LISTING_IDS[0], ownerId: "e2e-operator", title: "Синтетический пример оформления",
  description: "Изолированный пример карточки для проверки заметной маркировки. Не предложение о продаже.",
  category: "accessories", country: "RU", city: "Тестовый город", priceKopecks: 100000,
  condition: "used", contactUrl: "https://t.me/e2e_example_not_for_sale", legalVersion: LEGAL_VERSION,
  status: "published", publishedAt: new Date("2026-10-01T00:00:00Z"),
});
await db.insert(photos).values({id: randomUUID(), listingId: EXAMPLE_LISTING_IDS[0], storageKey: examplePhotoKey, position: 0, width: 600, height: 480});
await client.close();
const operatorToken = randomBytes(32).toString("hex");
await writeFile(".data/e2e-operator-token", operatorToken, {mode: 0o600});
await chmod(".data/e2e-operator-token", 0o600);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "4388",
  ],
  {
    env: {
      ...process.env,
      NODE_ENV: "development",
      AUTH_ENABLED: "true",
      WIKI_NOTEBOOK_ENABLED: process.env.E2E_WIKI_NOTEBOOK_ENABLED === "true" ? "true" : "false",
      LEGAL_PUBLIC_READY: "false",
      LEGAL_OPERATOR_NAME: "",
      LEGAL_OPERATOR_ADDRESS: "",
      LEGAL_CONTACT_EMAIL: "hello@shisha-market.com",
      LEGAL_APPROVED_MARKETS: "[]",
      LEGAL_DATA_LOCATION: "",
      LEGAL_PROCESSORS: "",
      LEGAL_RETENTION: "",
      APP_URL: "http://127.0.0.1:4388",
      DB_DRIVER: "pglite",
      PGLITE_PATH: join(directory, "postgres"),
      UPLOAD_PATH: join(directory, "uploads"),
      NEXT_BUILD_DIR: ".next-e2e",
      MAIL_MODE: "console",
      STORAGE_DRIVER: "local",
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      VK_CLIENT_ID: "",
      VK_CLIENT_SECRET: "",
      VK_GROUP_TOKEN: "",
      VK_GROUP_ID: "",
      YANDEX_METRIKA_TOKEN: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      GOOGLE_REFRESH_TOKEN: "",
      GA_MEASUREMENT_ID: "",
      METRIKA_COUNTER_ID: "",
      OPERATOR_TOKEN: operatorToken,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let buffer = "";
child.stdout.on("data", (data) => {
  buffer += String(data);
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    const match = line.match(/\[LOCAL EMAIL ONLY\] ([^:]+): (\d{6})/);
    if (match) {
      void appendFile(
        ".data/e2e-mailbox.jsonl",
        JSON.stringify({ email: match[1], otp: match[2], time: Date.now() }) +
          "\n",
        { mode: 0o600 },
      );
    } else process.stdout.write(line + "\n");
  }
});
child.stderr.pipe(process.stderr);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
