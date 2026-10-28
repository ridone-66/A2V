import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de fumée Playwright.
 *
 * Non exécutés par défaut dans cette livraison : les navigateurs ne sont pas
 * installés dans l'environnement de développement fourni. Pour les lancer :
 *   npx playwright install
 *   npm run db:start && npm run db:seed
 *   npm run dev            (dans un autre terminal)
 *   npm run test:e2e
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
