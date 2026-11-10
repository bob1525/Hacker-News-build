import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

const sqliteFiles: Record<string, string> = {
  concurrency: "/tmp/hn-concurrency.db",
  ranking_sql: "/tmp/hn-ranking-sql.db",
};

export function usesPostgres(env?: { DATABASE_URL?: string }): boolean {
  const url = env?.DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

/** SQLite keeps the existing temp files. PostgreSQL uses a schema of the same name. */
export function testDatabaseUrl(name: keyof typeof sqliteFiles, env?: { DATABASE_URL?: string }): string {
  const configured = env?.DATABASE_URL ?? process.env.DATABASE_URL ?? "";
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

  const sql = `DROP SCHEMA IF EXISTS "${name}" CASCADE;\nCREATE SCHEMA "${name}";\n`;
  execFileSync("bash", ["scripts/with-postgres-schema.sh", "prisma", "db", "execute", "--stdin"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
  });
  execFileSync(
    "bash",
    ["scripts/with-postgres-schema.sh", "prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
    {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    },
  );
  return databaseUrl;
}
