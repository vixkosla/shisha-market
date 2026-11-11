import { describe, expect, it } from "vitest";
import { brandGoods, readListing } from "@/lib/listing-smart";
import { smartAtlas } from "@/server/listing-atlas";

const atlas = smartAtlas();

describe("make directory from shop catalogs", () => {
  it("is broad and keeps tobacco makes and lounges out of the goods", () => {
    const goods = atlas.filter(brand => brandGoods(brand).length);
    expect(goods.length).toBeGreaterThan(180);
    const names = goods.map(brand => brand.name.toLowerCase());
    for (const tobacco of ["darkside", "tangiers", "fumari", "starbuzz", "black burn", "bonche", "wto", "element", "deus", "al fakher", "must have"])
      expect(names).not.toContain(tobacco);
    expect(names).not.toContain("hookahplace");
  });

  it("merges the atlas card with its catalog models", () => {
    const hoob = atlas.find(brand => brand.name === "HOOB")!;
    expect(hoob.atlas).toBe(true);
    expect(hoob.logo).not.toBeNull();
    expect(hoob.models).toContain("Atom");
  });

  it("recognises makes and catalog models from a title", () => {
    expect(readListing({ title: "Чаша Oblako Phunnel M глазурь", description: "" }, atlas)).toMatchObject({ brand: { name: "Oblako" }, model: "Phunnel M", category: "bowls", subcategory: "phunnel" });
    expect(readListing({ title: "Kaloud Lotus III", description: "" }, atlas)).toMatchObject({ brand: { name: "Kaloud" }, model: "Lotus III", category: "accessories", subcategory: "hmd" });
    expect(readListing({ title: "Шахта Tiaga Бита", description: "" }, atlas)).toMatchObject({ brand: { name: "Tiaga Hookah" }, category: "hookahs", subcategory: "shaft" });
    expect(readListing({ title: "Кальян Oduman N2", description: "" }, atlas)).toMatchObject({ brand: { name: "Oduman" }, model: "N2", category: "hookahs" });
    expect(readListing({ title: "Облако фаннел", description: "" }, atlas).brand?.name).toBe("Oblako");
  });

  it("does not guess a make from an ordinary word", () => {
    expect(readListing({ title: "Чаша, вес 300 грамм", description: "" }, atlas).brand).toBeNull();
    expect(readListing({ title: "Кальян для души", description: "" }, atlas).brand).toBeNull();
  });
});

describe("atlas makes keep their main goods", () => {
  it("names the category from the atlas even when catalogs list more goods", () => {
    expect(readListing({ title: "HOOB Atom чёрный", description: "" }, atlas)).toMatchObject({ category: "hookahs", suggestedTitle: "Кальян HOOB Atom чёрный" });
  });
});

describe("main goods of multi-goods makes", () => {
  it("takes the make's main goods and its accessory kind", () => {
    expect(readListing({ title: "Werkbund Evo Deep", description: "" }, atlas)).toMatchObject({ category: "bowls" });
    expect(readListing({ title: "Badcha 5.0", description: "" }, atlas)).toMatchObject({ category: "accessories", subcategory: "hmd" });
    expect(readListing({ title: "Arka Savant", description: "" }, atlas)).toMatchObject({ category: "accessories", subcategory: "hmd" });
    expect(readListing({ title: "Шланг Wookah", description: "" }, atlas)).toMatchObject({ category: "accessories", subcategory: "hose" });
  });
});
