import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  outputDir: "test-results/ui",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    browserName: "chromium",
    channel: "chrome",
    locale: "ja-JP",
    reducedMotion: "no-preference",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 864 } } },
    { name: "narrow", use: { viewport: { width: 375, height: 800 } } },
  ],
  webServer: {
    command: "npm run dev:ui -- --port 4174",
    url: "http://127.0.0.1:4174/tests/ui/preview.html",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
