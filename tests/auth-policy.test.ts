import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticationEnabled, authUnavailable } from "@/server/auth-policy";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { currentUser } from "@/server/session";

afterEach(() => vi.unstubAllEnvs());

describe("public infrastructure preview", () => {
  it("leaves development authentication enabled by default", () => {
    vi.stubEnv("AUTH_ENABLED", undefined);
    expect(authenticationEnabled()).toBe(true);
  });
  it("blocks both auth methods and sessions before accessing the database", async () => {
    vi.stubEnv("AUTH_ENABLED", "false");
    vi.stubEnv("DATABASE_URL", "postgresql://invalid/never-connect");
    expect(authenticationEnabled()).toBe(false);
    expect(await currentUser()).toBeNull();
    for (const method of ["GET", "POST"]) {
      const response = await (method === "GET" ? GET : POST)(
        new Request("https://example.test/api/auth/get-session", { method }),
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect((await authUnavailable().json()).error).toContain("пока недоступен");
  });
});
