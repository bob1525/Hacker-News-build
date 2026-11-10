import path from "node:path";
import {
  COMMENT_DUPLICATE_WINDOW_MS,
  COMMENT_RATE_LIMIT,
  COMMENT_RATE_WINDOW_MS,
  POST_DUPLICATE_WINDOW_MS,
  POST_RATE_LIMIT,
  POST_RATE_WINDOW_MS,
  VOTE_RATE_LIMIT,
  VOTE_RATE_WINDOW_MS,
} from "@/lib/config";
import { applyRateLimit, MemoryRateLimitStore, type RateDecision, type RateLimitStore } from "@/lib/domain/rate-limit";
import { SqliteRateLimitStore } from "@/lib/domain/sqlite-rate-limit-store";

export const RATE_RULES = {
  post: { limit: POST_RATE_LIMIT, windowMs: POST_RATE_WINDOW_MS },
  comment: { limit: COMMENT_RATE_LIMIT, windowMs: COMMENT_RATE_WINDOW_MS },
  vote: { limit: VOTE_RATE_LIMIT, windowMs: VOTE_RATE_WINDOW_MS },
} as const;

export { POST_DUPLICATE_WINDOW_MS, COMMENT_DUPLICATE_WINDOW_MS };

export function defaultRateLimitSqlitePath(): string {
  return path.join(process.cwd(), "prisma", "rate-limits.db");
}

/** `memory` keeps the original process-local map. `sqlite` persists hits in RATE_LIMIT_SQLITE_PATH. */
export function openRateLimitStore(env: NodeJS.ProcessEnv = process.env): RateLimitStore {
  const backend = (env.RATE_LIMIT_BACKEND ?? "memory").trim().toLowerCase();
  if (backend === "" || backend === "memory") return new MemoryRateLimitStore();
  if (backend === "sqlite") {
    const file = env.RATE_LIMIT_SQLITE_PATH?.trim() || defaultRateLimitSqlitePath();
    return new SqliteRateLimitStore(file);
  }
  throw new Error(`Unknown RATE_LIMIT_BACKEND "${backend}". Use memory or sqlite.`);
}

let activeStore: RateLimitStore | undefined;

export function getRateLimitStore(): RateLimitStore {
  activeStore ??= openRateLimitStore(process.env);
  return activeStore;
}

export function resetRateLimits(): void {
  getRateLimitStore().clear();
}

/** Test hook. Pass null to rebuild from the environment on the next check. */
export function useRateLimitStore(store: RateLimitStore | null): void {
  activeStore = store ?? undefined;
}

export function enforceRateLimit(scope: keyof typeof RATE_RULES, userId: string, now = Date.now()): RateDecision {
  const rule = RATE_RULES[scope];
  return applyRateLimit(getRateLimitStore(), `${scope}:${userId}`, rule.limit, rule.windowMs, now);
}
