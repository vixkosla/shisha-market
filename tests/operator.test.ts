import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/operator/listings/route";
import { POST as review } from "@/app/api/operator/listings/[id]/route";

afterEach(() => vi.unstubAllEnvs());

describe("operator listing API", () => {
  it.each([null, {}, { dataBase64: 42 }, { dataBase64: "" }])("rejects malformed photo payloads before accessing storage: %j", async (photo) => {
    vi.stubEnv("OPERATOR_TOKEN", "a".repeat(32));
    const response = await POST(new Request("http://127.0.0.1/api/operator/listings", {
      method: "POST",
      headers: { authorization: "Bearer " + "a".repeat(32), "content-type": "application/json" },
      body: JSON.stringify({
        title: "Синтетическая тестовая чаша",
        description: "Синтетическое описание для проверки API, не предложение продажи.",
        category: "bowls", country: "RU", city: "Москва", price: "2500", condition: "used",
        contactUrl: "https://vk.ru/test_profile", photos: [photo],
      }),
    }));
    expect(response.status).toBe(400);
  });
  it.each([undefined, 0, -1, 1.5, "1"])("requires an explicit valid revision before moderation: %s", async (revision) => {
    vi.stubEnv("OPERATOR_TOKEN", "a".repeat(32));
    const response = await review(new Request("http://127.0.0.1/api/operator/listings/synthetic", {
      method: "POST",
      headers: {authorization: "Bearer " + "a".repeat(32), "content-type": "application/json"},
      body: JSON.stringify({decision: "published", revision}),
    }), {params: Promise.resolve({id: "synthetic"})});
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({error: "Укажите revision из актуальной очереди проверки."});
  });
  it("hides the route when the token is not configured", async () => {
    vi.stubEnv("OPERATOR_TOKEN", "");
    const response = await GET(new Request("http://127.0.0.1/api/operator/listings"));
    expect(response.status).toBe(404);
  });
  it("rejects a wrong bearer token", async () => {
    vi.stubEnv("OPERATOR_TOKEN", "a".repeat(32));
    const response = await POST(
      new Request("http://127.0.0.1/api/operator/listings", {
        method: "POST",
        headers: { authorization: "Bearer " + "b".repeat(32) },
      }),
    );
    expect(response.status).toBe(401);
  });
});
