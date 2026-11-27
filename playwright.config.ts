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
    command: "bash scripts/e2e-server.sh",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      AUTH_SECRET: authSecret,
      MAILER: "smtp",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "2525",
      SMTP_FROM: "news@example.com",
      MAIL_LOG_PATH: "/tmp/hn-e2e-mail.log",
      NODE_ENV: "production",
    },
  },
});
