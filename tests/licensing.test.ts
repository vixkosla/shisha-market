import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("project licensing", () => {
  it("permits use and contributions under MIT without relicensing others' materials", () => {
    const license = read("LICENSE");
    expect(license).toContain("MIT License");
    expect(license).toContain("Permission is hereby granted, free of charge");
    expect(license).toContain("sublicense, and/or sell");
    expect(license).toContain("content/wiki/LICENSE");
    expect(license).toContain("User-submitted listings and photographs");
    expect(license).not.toContain("Public pull requests are not accepted");
    const readme = read("README.md");
    expect(readme).toContain("[MIT](LICENSE)");
    expect(readme).toContain("[CC BY-SA 4.0](content/wiki/LICENSE)");
    expect(readme).not.toContain("Лицензия закрытая");
  });

  it("licenses original wiki content and incoming wiki contributions under CC BY-SA", () => {
    const license = read("content/wiki/LICENSE");
    expect(license).toContain("SPDX-License-Identifier: CC-BY-SA-4.0");
    expect(license).toContain("https://creativecommons.org/licenses/by-sa/4.0/legalcode");
    expect(license).toContain("Contributions to the wiki are submitted under CC BY-SA 4.0");
    const guide = read("content/wiki/guide/contributing.md");
    expect(guide).toContain("Авторство остаётся за вами");
    expect(guide).toContain("по MIT");
    expect(read("content/wiki/index.md")).toContain("Код приложения отдельно лицензирован по MIT");
  });

  it("publishes the same license notices on the website as in the source tree", () => {
    expect(read("public/licenses/MIT.txt")).toBe(read("LICENSE"));
    expect(read("public/licenses/wiki-CC-BY-SA-4.0.txt")).toBe(read("content/wiki/LICENSE"));
  });
});
