import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const script = resolve("mcp/listings.mjs");
describe("MCP transport compatibility", () => {
  it("initializes and lists tools through the official standard stdio client", async () => {
    const client = new Client({name: "shisha-compatibility-test", version: "1.0.0"});
    const transport = new StdioClientTransport({command: process.execPath, args: [script], stderr: "pipe"});
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map(tool => tool.name)).toEqual(expect.arrayContaining(["create_listing", "get_listing", "get_listing_photo", "update_listing", "archive_listing", "list_pending", "moderate_listing"]));
      await client.ping();
      const result = await client.callTool({name: "create_listing", arguments: {photos: [resolve("package.json")]}});
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain("Other files were not sent");
    } finally { await client.close(); }
  }, 10000);

  it("accepts whitespace and malformed JSON without corrupting subsequent newline requests", async () => {
    const child = spawn(process.execPath, [script]);
    const lines: string[] = [];
    child.stdout.on("data", chunk => lines.push(String(chunk)));
    child.stdin.end('{bad json\n  {"jsonrpc":"2.0","id":7,"method":"ping"}\n');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error("MCP did not finish")); }, 5000);
      child.once("exit", code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`MCP exited ${code}`)); });
    });
    const messages = lines.join("").trim().split("\n").map(line => JSON.parse(line));
    expect(messages[0].error.code).toBe(-32700);
    expect(messages[1]).toEqual({jsonrpc: "2.0", id: 7, result: {}});
  });

  it("retains explicitly framed compatibility without emitting headers to standard hosts", async () => {
    const child = spawn(process.execPath, [script]);
    let output = "";
    child.stdout.on("data", chunk => {output += String(chunk);});
    const body = JSON.stringify({jsonrpc: "2.0", id: 8, method: "ping"});
    child.stdin.end(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {child.kill(); reject(new Error("MCP did not finish"));}, 5000);
      child.once("exit", code => {clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`MCP exited ${code}`));});
    });
    expect(output).toMatch(/^Content-Length:/);
    expect(JSON.parse(output.split("\r\n\r\n")[1])).toEqual({jsonrpc: "2.0", id: 8, result: {}});
  });
});
