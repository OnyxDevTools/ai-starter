// filename: playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.E2E_PORT || 3235);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid E2E_PORT");
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "node tests/preview.mjs",
    url: `http://127.0.0.1:${port}/sign-in`,
    timeout: 180000,
    reuseExistingServer: false,
  },
});
