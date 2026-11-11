import { describe, expect, it } from "vitest";
import { loginHref, safeLoginReturn } from "@/lib/login-return";
import { decodeListingDraft, encodeListingDraft, hasDraftContent } from "@/lib/listing-draft";

describe("safe login destination", () => {
  it.each([undefined, "https://example.com", "//example.com", "/\\example.com", "/login", "/admin", "/api/operator/listings", "/%2f%2fexample.com", "/listings/new\n"])("does not redirect to unsafe or unrelated paths: %s", value => {
    expect(safeLoginReturn(value)).toBe("/account");
  });
  it("returns to the requested form without retaining unrelated query parameters", () => {
    const edit = "/listings/70f97440-9036-4b9e-b8cf-1fc2b682cf1a/edit";
    expect(safeLoginReturn(edit)).toBe(edit);
    expect(safeLoginReturn("/listings/new?token=private")).toBe("/listings/new");
    expect(loginHref("/listings/new")).toBe("/login?next=%2Flistings%2Fnew");
    expect(loginHref(edit, true)).toContain("renew=1&next=");
    expect(loginHref()).toBe("/login");
  });
});

describe("tab-local listing drafts", () => {
  const fields = {title: "Синтетическая чаша", description: "Описание вещи", category: "bowls", country: "RU", condition: "used", city: "Москва", price: "2500", consentName: "Never persist this name", contactUrl: "https://t.me/private_contact", adult: "on"};
  it("persists product fields but never contacts, full names or consent choices", () => {
    const encoded = encodeListingDraft(fields, 1000);
    expect(encoded).not.toMatch(/Never persist|private_contact|consentName|adult|contactUrl/);
    expect(decodeListingDraft(encoded, 2000)).toEqual({title: fields.title, description: fields.description, category: "bowls", subcategory: "", brand: "", model: "", country: "RU", condition: "used", city: "Москва", price: "2500"});
    expect(hasDraftContent(fields)).toBe(true);
  });
  it("rejects corrupt, oversized and expired drafts instead of restoring unsafe values", () => {
    expect(decodeListingDraft("broken")).toBeNull();
    expect(decodeListingDraft(encodeListingDraft(fields, 1000), 86402000)).toBeNull();
    expect(decodeListingDraft(encodeListingDraft({...fields, title: "a".repeat(201)}, 1000), 2000)).toBeNull();
    expect(decodeListingDraft(encodeListingDraft(fields, 90000), 1000)).toBeNull();
    expect(hasDraftContent({...fields, title: "", description: "", city: "", price: ""})).toBe(false);
  });
});
