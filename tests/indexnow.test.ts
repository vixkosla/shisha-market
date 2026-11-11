import {describe, expect, it} from "vitest";
import {selectIndexNowUrls} from "../deploy/vps/indexnow.mjs";

describe("IndexNow release notification scope", () => {
  it("only selects the changed public home/wiki URLs, not contacts, accounts, listings or third-party hosts", () => {
    const urls = ["https://shisha-market.com/", "https://shisha-market.com/en", "https://shisha-market.com/wiki", "https://shisha-market.com/wiki/brands/alpha-hookah", "https://shisha-market.com/wiki/brands/alpha-hookah", "https://shisha-market.com/legal/privacy", "https://shisha-market.com/legal/contact", "https://shisha-market.com/login", "https://shisha-market.com/api/operator/listings", "https://shisha-market.com/listings/fixture", "https://shisha-market.com/wiki?private=1", "https://shisha-market.com/wiki#guide", "https://shisha-market.com/wiki/../account", "https://external.example.test/wiki/brands/alpha-hookah", "http://shisha-market.com/wiki", "https://name:password@shisha-market.com/wiki", "invalid"];
    const xml = urls.map(url => `<url><loc>${url}</loc></url>`).join("");
    expect(selectIndexNowUrls(xml)).toEqual(urls.slice(0, 4));
  });
});
