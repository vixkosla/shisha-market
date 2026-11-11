import { afterEach, describe, expect, it, vi } from "vitest";
import {
  allowedMarkets,
  assertListingPolicy,
  launchBlockers,
  legalLaunchReady,
} from "@/server/legal-policy";
import { authenticationEnabled } from "@/server/auth-policy";
import { legalDocuments } from "@/server/legal-documents";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { vkEnabled } from "@/server/auth";

afterEach(() => vi.unstubAllEnvs());
function readyConfiguration() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("AUTH_ENABLED", "true");
  vi.stubEnv("LEGAL_PUBLIC_READY", "true");
  vi.stubEnv("LEGAL_OPERATOR_NAME", "Синтетический оператор");
  vi.stubEnv("LEGAL_OPERATOR_ADDRESS", "Синтетический адрес для теста");
  vi.stubEnv("LEGAL_CONTACT_EMAIL", "test@example.test");
  vi.stubEnv("LEGAL_DATA_LOCATION", "Синтетическая конфигурация хранения");
  vi.stubEnv("LEGAL_PROCESSORS", "Синтетические исполнители");
  vi.stubEnv("LEGAL_RETENTION", "Синтетический срок хранения");
  vi.stubEnv(
    "LEGAL_APPROVED_MARKETS",
    '[{"country":"RU","categories":["accessories"]}]',
  );
}
describe("legal release checks", () => {
  it("does not let a single ready flag bypass missing operator or processing details", async () => {
    readyConfiguration();
    vi.stubEnv("LEGAL_OPERATOR_NAME", "");
    vi.stubEnv("DATABASE_URL", "postgresql://invalid/never-connect");
    expect(legalLaunchReady()).toBe(false);
    expect(authenticationEnabled()).toBe(false);
    expect(allowedMarkets()).toEqual([]);
    for (const handler of [GET, POST])
      expect(
        (
          await handler(
            new Request("https://example.test/api/auth/get-session"),
          )
        ).status,
      ).toBe(503);
  });
  it.each([
    "LEGAL_OPERATOR_ADDRESS",
    "LEGAL_DATA_LOCATION",
    "LEGAL_PROCESSORS",
    "LEGAL_RETENTION",
  ])("requires %s in production", (name) => {
    readyConfiguration();
    vi.stubEnv(name, "");
    expect(legalLaunchReady()).toBe(false);
  });
  it.each([
    "not-json",
    "[]",
    '[{"country":"XX","categories":["accessories"]}]',
    '[{"country":"RU","categories":["tobacco"]}]',
  ])("rejects missing or invalid market rules: %s", (value) => {
    readyConfiguration();
    vi.stubEnv("LEGAL_APPROVED_MARKETS", value);
    expect(allowedMarkets()).toEqual([]);
  });
  it("only allows the explicitly configured market, not all CIS categories", () => {
    readyConfiguration();
    expect(legalLaunchReady()).toBe(true);
    const item = {
      country: "RU",
      category: "accessories",
      condition: "used",
      title: "Синтетический предмет",
      description: "Синтетическое описание",
    };
    expect(() => assertListingPolicy(item)).not.toThrow();
    expect(() => assertListingPolicy({ ...item, country: "KZ" })).toThrow(
      "пока не открыта",
    );
    expect(() => assertListingPolicy({ ...item, category: "hookahs" })).toThrow(
      "пока не открыта",
    );
    vi.stubEnv("LEGAL_PUBLIC_READY", "false");
    expect(authenticationEnabled()).toBe(false);
    expect(launchBlockers()).toContain(
      "Подтверждение организационной готовности владельцем",
    );
  });
  it("does not re-enable unverified OAuth just because credentials exist", () => {
    vi.stubEnv("VK_CLIENT_ID", "synthetic");
    vi.stubEnv("VK_CLIENT_SECRET", "synthetic");
    expect(vkEnabled()).toBe(false);
  });
  it("contains the user's confirmed contact and no invented operator identity", () => {
    vi.stubEnv("LEGAL_OPERATOR_NAME", "");
    vi.stubEnv("LEGAL_OPERATOR_ADDRESS", "");
    vi.stubEnv("LEGAL_CONTACT_EMAIL", "");
    const contact = JSON.stringify(legalDocuments().contact);
    expect(contact).toContain("hello@shisha-market.com");
    expect(contact).toContain("Оператор ещё не указан");
    expect(contact).toContain("Самозанятый");
  });
  it("uses configured operator details consistently without opening an unready launch", () => {
    readyConfiguration();
    vi.stubEnv("LEGAL_DATA_LOCATION", "");
    vi.stubEnv("LEGAL_PUBLIC_READY", "false");
    const documents = legalDocuments();
    for (const name of ["contact", "privacy", "consent", "publication"] as const) {
      const text = JSON.stringify(documents[name]);
      expect(text).toContain("Синтетический оператор");
      expect(text).toContain("Синтетический адрес для теста");
      expect(text).not.toContain("Оператор ещё не указан");
      expect(text).not.toContain("Адрес ещё не указан");
    }
    expect(launchBlockers()).not.toContain(
      "Реквизиты оператора и рабочий адрес для обращений",
    );
    expect(legalLaunchReady()).toBe(false);
    expect(authenticationEnabled()).toBe(false);
    expect(allowedMarkets()).toEqual([]);
  });
});
