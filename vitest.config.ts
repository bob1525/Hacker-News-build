import path from "node:path";
import { defineConfig } from "vitest/config";

const databaseUrl = process.env.DATABASE_URL ?? "";
const postgres = databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://");

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // The two database files share one PostgreSQL server. Run them one at a time.
    fileParallelism: !postgres,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
