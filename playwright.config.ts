import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 4111);

/** End-to-end test of the main flow in replay mode against the production build (run `npm run test:e2e`). */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1440, height: 900 },
    // Uses the installed Chrome by default (no browser download). PW_CHANNEL=chromium after `npx playwright install chromium`.
    channel: process.env.PW_CHANNEL ?? "chrome",
    headless: true,
  },
  webServer: {
    command: `next start -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DEMO_REPLAY: "1", DATA_DIR: "./data/e2e" },
  },
});
