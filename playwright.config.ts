import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const databaseUrl = `file:${path.join(process.cwd(), "prisma", "e2e.db")}`;
const authSecret = "e2e-secret-key-not-for-production-use";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    channel: "chrome",
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next build && npx next start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      AUTH_SECRET: authSecret,
    },
  },
});
