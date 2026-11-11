import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("MCP client download", () => {
  it("ships the personal client without borrowing the operator credential", () => {
    const source = readFileSync("mcp/user.mjs", "utf8");
    expect(readFileSync("public/mcp/user.mjs", "utf8")).toBe(source);
    expect(source).not.toContain("SHISHA_OPERATOR_TOKEN");
    expect(source).not.toContain("/api/operator/");
    expect(source).not.toContain('name: "moderate_listing"');
  });
  it("keeps the public copy in sync with the source client", () => {
    const root = process.cwd();
    const source = readFileSync(join(root, "mcp/listings.mjs"), "utf8");
    const publicCopy = readFileSync(
      join(root, "public/mcp/listings.mjs"),
      "utf8",
    );
    expect(publicCopy).toBe(source);
  });
});
