import { describe, expect, it } from "vitest";
import { findCity, findPrice, readListing, splitPasted, type SmartBrand } from "@/lib/listing-smart";

const brand = (slug: string, name: string, kind: string, aliases: string[]): SmartBrand => ({ slug, name, kind, aliases, logo: null, rows: [], wiki: null });
const atlas = [
  brand("hoob", "HOOB", "Кальяны", ["hoob", "хуб"]),
  brand("kaloud", "Kaloud", "Устройства контроля жара", ["kaloud", "калауд", "lotus", "лотус"]),
  brand("alpha-hookah", "Alpha Hookah", "Кальяны", ["alpha hookah", "альфа хука"]),
  brand("hookahplace", "HookahPlace", "Сеть кальянных", ["hookahplace"]),
];

describe("smart listing reading", () => {
  it("finds the brand, the model and the rubric from the title", () => {
    const reading = readListing({ title: "HOOB Atom чёрный", description: "" }, atlas);
    expect(reading.brand?.slug).toBe("hoob");
    expect(reading.model).toBe("Atom");
    expect(reading.category).toBe("hookahs");
    expect(reading.categoryFrom).toBe("brand");
    expect(reading.suggestedTitle).toBe("Кальян HOOB Atom чёрный");
  });

  it("lets the head noun of the title beat the brand's kind", () => {
    const reading = readListing({ title: "Чаша для кальяна HOOB", description: "" }, atlas);
    expect(reading.category).toBe("bowls");
    expect(reading.categoryFrom).toBe("title");
    expect(reading.suggestedTitle).toBeNull();
  });

  it("reads a two-word model and Cyrillic spellings", () => {
    expect(readListing({ title: "Alpha Hookah Model X", description: "" }, atlas).model).toBe("Model X");
    expect(readListing({ title: "Калауд Лотус 2", description: "" }, atlas).brand?.slug).toBe("kaloud");
    expect(readListing({ title: "Калауд Лотус 2", description: "" }, atlas).category).toBe("accessories");
  });

  it("ignores atlas entries that are not goods", () => {
    expect(readListing({ title: "Кальян из HookahPlace", description: "" }, atlas).brand).toBeNull();
  });

  it("finds price and city in free text", () => {
    expect(findPrice("Отдам за 9 000 руб, Москва")).toBe("9000");
    expect(findPrice("цена: 2500")).toBe("2500");
    expect(findPrice("12 тыс")).toBe("12000");
    expect(findPrice("12,5к")).toBe("12500");
    expect(findPrice("шахта 2018 года")).toBeNull();
    expect(findCity("самовывоз СПб, м. Площадь Восстания")).toBe("Санкт-Петербург");
    expect(findCity("Отправлю из г. Пятигорск")).toBe("Пятигорск");
    expect(findCity("в Уфе")).toBe("Уфа");
    expect(findCity("Атом чёрный")).toBeNull();
  });

  it("warns about tobacco and lists what the description lacks", () => {
    expect(readListing({ title: "Табак для кальяна", description: "" }, atlas).tobacco).toBe(true);
    const reading = readListing({ title: "HOOB Atom", description: "Без сколов, в комплекте коробка" }, atlas);
    expect(reading.tobacco).toBe(false);
    expect(reading.checklist.filter(item => item.done).map(item => item.key)).toEqual(["state", "kit"]);
  });

  it("splits a pasted ad into fields", () => {
    const fields = splitPasted("Кальян HOOB Atom — 9 000 ₽\n\nПользовался полгода, без сколов.\nМосква, самовывоз.", atlas);
    expect(fields).toEqual({ title: "Кальян HOOB Atom", description: "Пользовался полгода, без сколов.\nМосква, самовывоз.", price: "9000", city: "Москва", category: "hookahs" });
  });
});

describe("price edge cases", () => {
  it("does not read «к» as thousands when it is a preposition", () => {
    expect(findPrice("5 к комплекту шланг")).toBeNull();
  });
});

describe("subcategories from the title", () => {
  it("names the part or kind of thing", () => {
    expect(readListing({ title: "HOOB Atom", description: "" }, atlas).subcategory).toBe("complete");
    expect(readListing({ title: "Шахта HOOB Atom", description: "" }, atlas).subcategory).toBe("shaft");
    expect(readListing({ title: "Чаша фаннел Oblako", description: "" }, atlas).subcategory).toBe("phunnel");
    expect(readListing({ title: "Калауд Лотус 2", description: "" }, atlas).subcategory).toBe("hmd");
    expect(readListing({ title: "Шланг силиконовый", description: "" }, atlas)).toMatchObject({ category: "accessories", subcategory: "hose" });
  });
});
