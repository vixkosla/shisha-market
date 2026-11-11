import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Run once as root on the target after users and PostgreSQL are provisioned.
// Never print credentials or pass a database password as a command argument.
for (const file of ["app.env", "garage.env", "garage.toml"]) {
  if (existsSync(`/etc/shisha-market/${file}`)) throw new Error(`Refusing to replace ${file}`);
}
const dbPassword = randomBytes(32).toString("hex");
const accessKey = `GK${randomBytes(16).toString("hex")}`;
const secretKey = randomBytes(32).toString("hex");
const write = (name, body) => writeFileSync(`/etc/shisha-market/${name}`, body, { mode: 0o600, flag: "wx" });
write("app.env", [
  "APP_URL=https://SERVER_IP", "AUTH_ENABLED=false", "DB_DRIVER=postgres",
  `DATABASE_URL=postgresql://shisha:${dbPassword}@127.0.0.1:5432/shisha`,
  `BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}`, "MAIL_MODE=smtp",
  "STORAGE_DRIVER=s3", "S3_ENDPOINT=http://127.0.0.1:3900", "S3_REGION=garage",
  "S3_BUCKET=shisha-photos", `S3_ACCESS_KEY_ID=${accessKey}`, `S3_SECRET_ACCESS_KEY=${secretKey}`, "",
].join("\n"));
write("garage.env", `GARAGE_DEFAULT_ACCESS_KEY=${accessKey}\nGARAGE_DEFAULT_SECRET_KEY=${secretKey}\nGARAGE_DEFAULT_BUCKET=shisha-photos\n`);
write("garage.toml", `metadata_dir = "/var/lib/shisha-storage/meta"
data_dir = "/var/lib/shisha-storage/data"
db_engine = "sqlite"
replication_factor = 1
rpc_bind_addr = "127.0.0.1:3901"
rpc_public_addr = "127.0.0.1:3901"
rpc_secret = "${randomBytes(32).toString("hex")}"
[s3_api]
s3_region = "garage"
api_bind_addr = "127.0.0.1:3900"
`);
execFileSync("chown", ["shisha-storage:shisha-storage", "/etc/shisha-market/garage.toml"]);
execFileSync("runuser", ["-u", "postgres", "--", "psql", "-v", "ON_ERROR_STOP=1"], {
  input: `SET log_statement = 'none';\nCREATE ROLE shisha WITH LOGIN PASSWORD '${dbPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE;\nCREATE DATABASE shisha OWNER shisha;\n`,
  stdio: ["pipe", "ignore", "pipe"],
});
console.info("Created private application credentials and database.");
