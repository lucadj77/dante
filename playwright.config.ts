import { defineConfig, devices } from "@playwright/test";

// Tests of the interface on the web version, with the sample project: what a writer does
// first (open, write, add a scene, export to Word) must keep working. Everything runs in
// Chromium; the English tests run in WebKit too, the engine of Safari and of the Mac app,
// where it is installed (in CI, or with WEBKIT=1 after `npx playwright install webkit`).
const webkit = !!process.env.CI || !!process.env.WEBKIT;
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1280, height: 820 },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 820 } } },
    ...(webkit ? [{ name: "webkit", testMatch: /english\.spec\.ts/, use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 820 } } }] : []),
  ],
  webServer: {
    command: "npm run build:web && npx vite preview --port 4173 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
