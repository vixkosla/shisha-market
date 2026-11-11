import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:4388",
    headless: true,
    viewport: { width: 1440, height: 1080 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx tsx scripts/e2e-server.ts",
    url: "http://127.0.0.1:4388/api/health",
    reuseExistingServer: false,
    timeout: 90000,
  },
});
