import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a live API that serves the built frontend:
 *   bun run build && (cd ../api && STATIC_DIR=../web/dist cargo run)
 * Point PIRE_URL elsewhere to test another deployment.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PIRE_URL ?? "http://127.0.0.1:8080",
    viewport: { width: 1440, height: 900 },
  },
  reporter: [["list"]],
});
