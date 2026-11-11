#!/usr/bin/env node
// Operator MCP client. Documentation: https://shisha-market.com/mcp
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const origin = (process.env.SHISHA_APP_URL ?? "https://shisha-market.com").replace(
  /\/$/,
  "",
);
const app = new URL(origin);
if (app.username || app.password || app.search || app.hash || app.pathname !== "/" ||
    (app.protocol !== "https:" && !(app.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(app.hostname)))) {
  throw new Error("SHISHA_APP_URL must be an HTTPS origin (HTTP is allowed only on loopback for tests).");
}

function operatorToken() {
  if (process.env.SHISHA_OPERATOR_TOKEN?.trim())
    return process.env.SHISHA_OPERATOR_TOKEN.trim();
  const file =
    process.env.SHISHA_OPERATOR_TOKEN_FILE ??
    join(homedir(), ".config/shisha-market/operator.token");
  return readFileSync(file, "utf8").trim();
}

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${operatorToken()}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (response.ok) return response;
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text.slice(0, 400) };
  }
  throw new Error(data.error || `HTTP ${response.status}`);
}

async function api(path, options) {
  return (await request(path, options)).json();
}

function localPhotos(paths = []) {
  if (!Array.isArray(paths) || paths.length > 6) throw new Error("Choose at most 6 local image files.");
  let total = 0;
  return paths.map(path => {
    if (typeof path !== "string") throw new Error("Photos must be local file paths.");
    const info = statSync(path);
    if (!info.isFile() || info.size <= 0 || info.size > 8 * 1024 * 1024) throw new Error("Each photo must be a non-empty file, at most 8 MB.");
    total += info.size;
    if (total > 8 * 1024 * 1024) throw new Error("The combined size of new photos must not exceed 8 MB.");
    const bytes = readFileSync(path);
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp = bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
    if (!jpeg && !png && !webp) throw new Error("Only JPG, PNG and WebP image contents may be uploaded. Other files were not sent.");
    return {dataBase64: bytes.toString("base64")};
  });
}

const tools = [
  {
    name: "create_listing",
    description:
      "Create an operator-owned listing with 1-6 local JPG/PNG/WebP files, up to 8 MB combined. Pending by default. Use get_listing and get_listing_photo to review before moderation. Set publish=true only with explicit user approval: it makes the listing public and may trigger configured VK autoposting. No payments or delivery.",
    annotations: {readOnlyHint: false, destructiveHint: false, openWorldHint: true},
    inputSchema: {
      type: "object",
      required: [
        "title",
        "description",
        "category",
        "city",
        "price",
        "contactUrl",
        "photos",
      ],
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        category: { type: "string", enum: ["hookahs", "bowls", "accessories"] },
        country: { type: "string", default: "RU" },
        city: { type: "string" },
        price: { type: "string", description: "Rubles, for example 2500 or 2500,50" },
        contactUrl: {
          type: "string",
          description: "https://vk.ru/name or https://t.me/name",
        },
        photos: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: { type: "string" },
        },
        publish: { type: "boolean", default: false },
      },
    },
  },
  {
    name: "list_pending",
    description: "List listings waiting for moderation.",
    inputSchema: { type: "object", properties: {} },
    annotations: {readOnlyHint: true, openWorldHint: true},
  },
  {
    name: "get_listing",
    description: "Inspect the complete listing, moderation note, current revision, photos and actual public visibility. Operator-only; does not reveal account email or consent full name.",
    inputSchema: {type: "object", required: ["id"], properties: {id: {type: "string", format: "uuid"}}},
    annotations: {readOnlyHint: true, openWorldHint: true},
  },
  {
    name: "get_listing_photo",
    description: "View one listing photo, including private pending/rejected media, as MCP image content. Use an id and photoId from get_listing; no public photo URL or token is exposed.",
    inputSchema: {type: "object", required: ["id", "photoId"], properties: {id: {type: "string", format: "uuid"}, photoId: {type: "string", format: "uuid"}}},
    annotations: {readOnlyHint: true, openWorldHint: true},
  },
  {
    name: "update_listing",
    description: "Correct only the operator's own active/rejected listing. Supply its current revision and the fields to change; omitted fields/photos are retained. New photos append; keepPhotoIds optionally selects retained photos. Every save returns the listing to pending and requires fresh review. Never silently retry a stale revision.",
    inputSchema: {type: "object", required: ["id", "revision"], properties: {
      id: {type: "string", format: "uuid"}, revision: {type: "integer", minimum: 1},
      title: {type: "string"}, description: {type: "string"}, category: {type: "string", enum: ["hookahs", "bowls", "accessories"]},
      country: {type: "string"}, city: {type: "string"}, price: {type: "string"}, contactUrl: {type: "string"},
      photos: {type: "array", maxItems: 6, items: {type: "string"}}, keepPhotoIds: {type: "array", maxItems: 6, items: {type: "string", format: "uuid"}},
    }},
    annotations: {readOnlyHint: false, destructiveHint: true, openWorldHint: true},
  },
  {
    name: "archive_listing",
    description: "Withdraw only an operator-owned listing using its current revision. It is removed from the site, not physically erased. This does not delete existing VK posts; handle those separately. Confirm with the user before withdrawing.",
    inputSchema: {type: "object", required: ["id", "revision"], properties: {id: {type: "string", format: "uuid"}, revision: {type: "integer", minimum: 1}}},
    annotations: {readOnlyHint: false, destructiveHint: true, openWorldHint: true},
  },
  {
    name: "moderate_listing",
    description: "Publish or reject a pending listing only after human approval and review of current text and all photos. Publication makes it public and may trigger configured VK autoposting. Stale revisions are rejected; rejection requires a reason.",
    annotations: {readOnlyHint: false, destructiveHint: true, openWorldHint: true},
    inputSchema: {
      type: "object",
      required: ["id", "decision", "revision"],
      properties: {
        id: { type: "string" },
        decision: { type: "string", enum: ["published", "rejected"] },
        revision: { type: "integer", minimum: 1, description: "Exact revision returned by list_pending; re-review if it changes." },
        note: { type: "string" },
      },
    },
  },
];

async function callTool(name, args = {}) {
  if (name === "list_pending") return api("/api/operator/listings");
  if (["get_listing", "get_listing_photo", "update_listing", "archive_listing", "moderate_listing"].includes(name) && !/^[0-9a-f-]{36}$/i.test(args.id ?? "")) throw new Error("A valid listing id is required.");
  if (name === "get_listing") return api(`/api/operator/listings/${args.id}`);
  if (name === "get_listing_photo") {
    if (!/^[0-9a-f-]{36}$/i.test(args.photoId ?? "")) throw new Error("A valid photoId from get_listing is required.");
    const response = await request(`/api/operator/listings/${args.id}/photos/${args.photoId}`);
    if (!response.headers.get("content-type")?.startsWith("image/webp")) throw new Error("The server did not return an image.");
    return [{type: "image", mimeType: "image/webp", data: Buffer.from(await response.arrayBuffer()).toString("base64")}];
  }
  if (name === "archive_listing") return api(`/api/operator/listings/${args.id}/archive`, {method: "POST", body: {revision: args.revision}});
  if (name === "update_listing") {
    const {id, photos, ...changes} = args;
    return api(`/api/operator/listings/${id}`, {method: "PATCH", body: {...changes, photos: localPhotos(photos)}});
  }
  if (name === "moderate_listing")
    return api(`/api/operator/listings/${args.id}`, {
      method: "POST",
      body: { decision: args.decision, note: args.note ?? "", revision: args.revision },
    });
  if (name === "create_listing") {
    const photos = localPhotos(args.photos);
    if (!photos.length) throw new Error("Choose 1-6 local image files.");
    return api("/api/operator/listings", {
      method: "POST",
      body: {
        title: args.title,
        description: args.description,
        category: args.category,
        country: args.country ?? "RU",
        city: args.city,
        price: String(args.price),
        condition: "used",
        contactUrl: args.contactUrl,
        photos,
        publish: args.publish === true,
      },
    });
  }
  throw new Error(`Unknown tool: ${name}`);
}

function reply(message, framing = "line") {
  const json = JSON.stringify(message);
  process.stdout.write(
    framing === "headers" ? `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}` : `${json}\n`,
  );
}

async function handle(message, framing) {
  const send = value => reply(value, framing);
  if (!message || message.jsonrpc !== "2.0") return;
  if (message.method === "notifications/initialized" || message.method === "initialized")
    return;
  if (message.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"].includes(message.params?.protocolVersion) ? message.params.protocolVersion : "2025-11-25",
        capabilities: { tools: {} },
        serverInfo: { name: "shisha-market", version: "0.2.0" },
      },
    });
    return;
  }
  if (message.method === "tools/list") {
    send({ jsonrpc: "2.0", id: message.id, result: { tools } });
    return;
  }
  if (message.method === "ping") {
    send({ jsonrpc: "2.0", id: message.id, result: {} });
    return;
  }
  if (message.method === "tools/call") {
    try {
      const result = await callTool(
        message.params?.name,
        message.params?.arguments ?? {},
      );
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          content: message.params?.name === "get_listing_photo" ? result : [{ type: "text", text: JSON.stringify(result, null, 2) }],
        },
      });
    } catch (error) {
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          isError: true,
          content: [{ type: "text", text: error.message }],
        },
      });
    }
    return;
  }
  if (message.id !== undefined)
    send({
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32601, message: `Unknown method ${message.method}` },
    });
}

let buffer = Buffer.alloc(0);
const pending = new Set();
function dispatch(body, framing) {
  let message;
  try { message = JSON.parse(body); } catch {
    reply({jsonrpc: "2.0", id: null, error: {code: -32700, message: "Invalid JSON"}}, framing);
    return;
  }
  // Notifications cannot trigger mutations without a request id.
  if (message?.id === undefined) return;
  const work = handle(message, framing).catch(error => console.error("mcp", error.message));
  pending.add(work);
  work.finally(() => pending.delete(work));
}
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  if (buffer.length > 1024 * 1024) { console.error("MCP request exceeds 1 MB"); process.exitCode = 1; process.stdin.destroy(); return; }
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    const lineEnd = buffer.indexOf("\n");
    const prefix = buffer.subarray(0, Math.min(buffer.length, 15)).toString().trimStart();
    if (/^Content-Length:/i.test(prefix) || (prefix && "content-length:".startsWith(prefix.toLowerCase()))) {
      if (headerEnd < 0) return;
      const header = buffer.slice(0, headerEnd).toString("utf8");
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const start = headerEnd + 4;
      if (buffer.length < start + length) return;
      const body = buffer.slice(start, start + length).toString("utf8");
      buffer = buffer.slice(start + length);
      dispatch(body, "headers");
      continue;
    }
    if (lineEnd >= 0) {
      const line = buffer.slice(0, lineEnd).toString("utf8").trim();
      buffer = buffer.slice(lineEnd + 1);
      if (line) dispatch(line, "line");
      continue;
    }
    return;
  }
});
process.stdin.on("end", async () => { await Promise.allSettled(pending); });
