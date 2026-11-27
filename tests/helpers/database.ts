import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { configuredDatabaseUrl } from "@/lib/sql-dialect";

const sqliteFiles: Record<string, string> = {
  concurrency: "/tmp/hn-concurrency.db",
  ranking_sql: "/tmp/hn-ranking-sql.db",
  search: "/tmp/hn-search.db",
  collapse: "/tmp/hn-collapse.db",
  email: "/tmp/hn-email.db",
  emailDelivery: "/tmp/hn-email-delivery.db",
  passwordReset: "/tmp/hn-password-reset.db",
  sessionRevoke: "/tmp/hn-session-revoke.db",
  searchUnicode: "/tmp/hn-search-unicode.db",
  searchFold: "/tmp/hn-search-fold.db",
  emailChange: "/tmp/hn-email-change.db",
  downvotes: "/tmp/hn-downvotes.db",
  depth: "/tmp/hn-comment-depth.db",
  searchWindow: "/tmp/hn-search-window.db",
};

export function usesPostgres(env?: { DATABASE_URL?: string }): boolean {
  const url = configuredDatabaseUrl(env);
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

/** SQLite keeps the existing temp files. PostgreSQL uses a schema of the same name. */
export function testDatabaseUrl(name: keyof typeof sqliteFiles, env?: { DATABASE_URL?: string }): string {
  const configured = configuredDatabaseUrl(env);
  if (!usesPostgres(env)) return `file:${sqliteFiles[name]}`;
  const url = new URL(configured);
  url.searchParams.set("schema", name);
  return url.toString();
}

export function prepareTestDatabase(name: keyof typeof sqliteFiles): string {
  const databaseUrl = testDatabaseUrl(name);
  if (!usesPostgres()) {
    rmSync(sqliteFiles[name], { force: true });
    execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });
    return databaseUrl;
  }

  execFileSync("bash", ["scripts/apply-postgres-migration.sh"], {
    env: { ...process.env, DATABASE_URL: databaseUrl, POSTGRES_SCHEMA: name },
    stdio: "inherit",
  });
  return databaseUrl;
}
