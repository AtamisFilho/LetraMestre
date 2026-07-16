import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config.
 *
 * The `webServer` starts ONLY the Next.js dev server on :3000. The game-server
 * (:3003) is NOT started by this config — tests that need it (e.g.
 * create-game) must be `test.skip`-ed unless the CI job starts the
 * game-server separately (see worklog 5-d §CI for the e2e job template).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 120_000, // Next dev cold-start in CI can be slow
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
