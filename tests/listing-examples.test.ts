import {describe, expect, it} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {NextRequest} from "next/server";
import {ListingCard} from "@/components/listing-card";
import {EXAMPLE_LISTING_IDS, exampleListingCopy, isExampleListing} from "@/lib/listing-examples";
import {statusNames} from "@/lib/i18n";
import type {listings} from "@/server/db/schema";
import {proxy} from "@/proxy";

function item(id: string): typeof listings.$inferSelect {
  return {
    id, ownerId: "synthetic-owner", title: "Пример: обычная пользовательская вещь", description: "Описание вещи",
    category: "accessories", subcategory: null, brand: null, model: null, country: "RU", city: "Тестовый город", priceKopecks: 125000, condition: "used",
    contactUrl: "https://t.me/synthetic_profile", contactConditions: "", legalVersion: "test", status: "published",
    revision: 1, moderationNote: null, publishedAt: new Date(), vkPostId: null, createdAt: new Date(), updatedAt: new Date(),
  };
}

describe("explicit launch examples", () => {
  it("marks only the six verified launch IDs, never new listings based on their title or author", () => {
    expect(EXAMPLE_LISTING_IDS).toHaveLength(6);
    expect(new Set(EXAMPLE_LISTING_IDS).size).toBe(6);
    for (const id of EXAMPLE_LISTING_IDS) expect(isExampleListing(id)).toBe(true);
    expect(isExampleListing("4d4b6dbe-1260-4dba-8409-de70a05d0c75")).toBe(false);
    expect(isExampleListing("Пример: Кальян")).toBe(false);
    expect(isExampleListing("")).toBe(false);
  });

  it("labels both the photo and caption and calls the price illustrative in both locales", () => {
    for (const locale of ["ru", "en"] as const) {
      for (const coverId of [undefined, "synthetic-photo"]) {
        const html = renderToStaticMarkup(createElement(ListingCard, {item: {...item(EXAMPLE_LISTING_IDS[0]), coverId}, locale}));
        expect(html).toContain('data-example="true"');
        expect(html).toContain('class="listing-example-label"');
        expect(html).toContain(exampleListingCopy[locale].photoLabel);
        expect(html).toContain(exampleListingCopy[locale].caption);
        expect(html).toContain(exampleListingCopy[locale].priceLabel);
        expect(html).not.toContain('class="image-label"');
      }
    }
  });

  it("keeps a real listing real even if its title says example and its owner is the same", () => {
    const html = renderToStaticMarkup(createElement(ListingCard, {item: item("4d4b6dbe-1260-4dba-8409-de70a05d0c75")}));
    expect(html).not.toContain('data-example="true"');
    expect(html).not.toContain("listing-example-label");
    expect(html).not.toContain("Условная цена");
    expect(html).toContain('class="image-label"');
  });

  it("retains management status labels alongside the example badge in the owner's account", () => {
    const html = renderToStaticMarkup(createElement(ListingCard, {item: {...item(EXAMPLE_LISTING_IDS[0]), status: "archived"}, showStatus: true}));
    expect(html).toContain("listing-example-label");
    expect(html).toContain('class="image-label"');
    expect(html).toContain(statusNames.ru.archived);
  });

  it("backs up example noindex metadata with an HTTP directive without closing normal listings", () => {
    for (const id of EXAMPLE_LISTING_IDS) expect(proxy(new NextRequest(`https://shisha-market.com/listings/${id}`)).headers.get("X-Robots-Tag")).toBe("noindex, follow");
    expect(proxy(new NextRequest("https://shisha-market.com/listings/4d4b6dbe-1260-4dba-8409-de70a05d0c75")).headers.get("X-Robots-Tag")).toBeNull();
  });
});
