import {describe, expect, it} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {ExternalListings} from "@/components/external-listings";
import {EXTERNAL_LISTINGS, externalListingCopy, externalListingState, getExternalListings} from "@/lib/external-listings";

const reviewedAt = new Date("2026-11-08T12:00:00Z");

describe("editorial external offers", () => {
  it("keeps traceable source, date and the source's seller contact, without fake user identities or photos", () => {
    expect(new Set(EXTERNAL_LISTINGS.map(item => item.id)).size).toBe(EXTERNAL_LISTINGS.length);
    expect(EXTERNAL_LISTINGS.length).toBeGreaterThan(0);
    for (const item of EXTERNAL_LISTINGS) {
      for (const link of [item.sourceUrl, item.contactUrl, item.contactEvidenceUrl]) {
        const url = new URL(link);
        expect(url.protocol).toBe("https:");
        expect(url.hostname).toBe("t.me");
        expect(url.username + url.password + url.search + url.hash).toBe("");
      }
      expect(Date.parse(item.publishedAt)).toBeLessThanOrEqual(Date.parse(item.checkedAt));
      expect(Date.parse(item.reviewBy)).toBeGreaterThan(Date.parse(item.checkedAt));
      expect(item).not.toHaveProperty("ownerId");
      expect(item).not.toHaveProperty("photo");
    }
  });

  it("respects category, city, multi-word search and the first-page boundary in both languages", () => {
    expect(getExternalListings({}, reviewedAt)).toHaveLength(EXTERNAL_LISTINGS.length);
    expect(getExternalListings({q: "darkside УФА"}, reviewedAt).map(item => item.id)).toEqual(["hookah-guru-118"]);
    expect(getExternalListings({q: "hoob atom", city: "Moscow", category: "hookahs"}, reviewedAt).map(item => item.id)).toEqual(["hookah-guru-110"]);
    expect(getExternalListings({category: "bowls"}, reviewedAt)).toEqual([]);
    expect(getExternalListings({city: "Казань"}, reviewedAt)).toEqual([]);
    expect(getExternalListings({q: "неизвестная модель"}, reviewedAt)).toEqual([]);
    expect(getExternalListings({page: "2"}, reviewedAt)).toEqual([]);
  });

  it("keeps overdue cards with their original dates while not exposing future-dated checks", () => {
    expect(getExternalListings({}, new Date("2026-10-23T12:00:00Z"))).toEqual([]);
    const old = EXTERNAL_LISTINGS.find(item => item.id === "hookah-guru-118")!;
    expect(externalListingState(old, new Date("2026-11-06T23:59:59Z"))).toBe("listed");
    expect(externalListingState(old, new Date("2026-11-07T00:00:00Z"))).toBe("needs_review");
    expect(getExternalListings({}, new Date("2027-01-01T00:00:00Z"))).toEqual(expect.arrayContaining([...EXTERNAL_LISTINGS]));
    expect(getExternalListings({q: "darkside", city: "Уфа"}, reviewedAt)).toEqual([old]);
    expect(old.publishedAt).toBe("2026-10-18T20:38:13Z");
    expect(old.checkedAt).toBe("2026-10-24T00:00:00Z");
  });

  it("labels overdue cards without presenting old links as recently verified", () => {
    for (const locale of ["ru", "en"] as const) {
      const html = renderToStaticMarkup(createElement(ExternalListings, {items: EXTERNAL_LISTINGS, locale, now: new Date("2027-01-01T00:00:00Z")}));
      expect(html.match(/data-external-state="needs_review"/g)).toHaveLength(EXTERNAL_LISTINGS.length);
      expect(html).toContain(externalListingCopy[locale].states.needs_review.label);
      expect(html).not.toContain(externalListingCopy[locale].states.listed.detail);
    }
  });

  it("retains explicitly sold or unavailable source records without inviting contact about an active offer", () => {
    for (const state of ["sold", "unavailable"] as const) {
      const item = {...EXTERNAL_LISTINGS[0], state};
      expect(externalListingState(item, reviewedAt)).toBe(state);
      for (const locale of ["ru", "en"] as const) {
        const html = renderToStaticMarkup(createElement(ExternalListings, {items: [item], locale, now: reviewedAt}));
        expect(html).toContain(item.title);
        expect(html).toContain(externalListingCopy[locale].states[state].label);
        expect(html).toContain(`href="${item.sourceUrl}"`);
        expect(html).not.toContain(`href="${item.contactUrl}"`);
        expect(html).toContain(`external=${item.id}#external-report`);
      }
    }
  });

  it("makes provenance and dates visible, links contact and original separately, never embeds a tracker", () => {
    for (const locale of ["ru", "en"] as const) {
      const html = renderToStaticMarkup(createElement(ExternalListings, {items: EXTERNAL_LISTINGS, locale}));
      expect(html).toContain(externalListingCopy[locale].badge);
      expect(html).toContain(externalListingCopy[locale].intro);
      expect(html).toContain(externalListingCopy[locale].checked);
      expect(html).toContain(externalListingCopy[locale].published);
      expect(html).not.toMatch(/<iframe|<script|<img|\/media\//);
      for (const item of EXTERNAL_LISTINGS) {
        expect(html).toContain(`href="${item.sourceUrl}"`);
        expect(html).toContain(`href="${item.contactUrl}"`);
        expect(html).toMatch(new RegExp(`datetime="${item.publishedAt}"`, "i"));
        expect(html).toContain(`external=${item.id}#external-report`);
      }
    }
    expect(renderToStaticMarkup(createElement(ExternalListings, {items: [], locale: "ru"}))).toBe("");
  });
});
