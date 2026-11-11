import { describe, expect, it } from "vitest";
import {
  catalogHref,
  chrome,
  home,
  localePath,
  statusNames,
} from "@/lib/i18n";
import { llmsFull, llmsIndex } from "@/lib/llms";

const base = "https://shisha-market.com";

describe("locale paths", () => {
  it("keeps Russian at the root and prefixes English", () => {
    expect(localePath("ru", "/")).toBe("/");
    expect(localePath("ru", "/legal/rules")).toBe("/legal/rules");
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "/mcp")).toBe("/en/mcp");
    expect(localePath("en", "/legal/rules")).toBe("/en/legal/rules");
  });

  it("builds catalog links with filters and pagination", () => {
    expect(catalogHref("ru", {})).toBe("/#catalog");
    expect(catalogHref("en", {})).toBe("/en#catalog");
    expect(catalogHref("ru", { category: "bowls" })).toBe(
      "/?category=bowls#catalog",
    );
    expect(catalogHref("en", { q: "bowl", city: "Москва" }, 2)).toBe(
      "/en?q=bowl&city=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0&page=2#catalog",
    );
    expect(catalogHref("ru", {}, 1)).toBe("/#catalog");
  });
});

describe("translations", () => {
  it("covers both locales for chrome and home copy", () => {
    for (const locale of ["ru", "en"] as const) {
      expect(chrome[locale].nav.catalog.length).toBeGreaterThan(0);
      expect(home[locale].heroTitle).toHaveLength(3);
      expect(home[locale].principles).toHaveLength(3);
      expect(statusNames[locale].published.length).toBeGreaterThan(0);
    }
    expect(home.en.catalogTitle).toBe("Listings");
    expect(statusNames.en.rejected).toBe("Rejected");
  });
});

describe("agent resources", () => {
  it("indexes the key pages and the status endpoint", () => {
    const text = llmsIndex(base);
    expect(text).toContain(`${base}/en/mcp`);
    expect(text).toContain(`${base}/ai/status`);
    expect(text).toContain(`${base}/mcp/listings.mjs`);
    expect(text).toContain("113672611");
  });

  it("describes the MCP tools without credentials", () => {
    const text = llmsFull(base);
    expect(text).toContain("create_listing");
    expect(text).toContain("moderate_listing");
    expect(text).toContain("revision");
    expect(text).not.toMatch(/Bearer [A-Za-z0-9]{32,}/);
  });
});
