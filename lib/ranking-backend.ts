export type RankingBackend = "memory" | "sql";

/** `memory` sorts in process. `sql` pages hot and newest in the database. Search stays in process. */
export function rankingBackend(env: NodeJS.ProcessEnv = process.env): RankingBackend {
  const value = (env.RANKING_BACKEND ?? "memory").trim().toLowerCase();
  if (value === "" || value === "memory") return "memory";
  if (value === "sql") return "sql";
  throw new Error(`Unknown RANKING_BACKEND "${value}". Use memory or sql.`);
}
