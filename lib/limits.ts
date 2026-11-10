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
import Redis from "ioredis";
import {
  applyRateLimit,
  applyRateLimitAsync,
  MemoryRateLimitStore,
  type RateDecision,
  type RateLimitStore,
} from "@/lib/domain/rate-limit";
import { RateLimitStoreError, RedisRateLimitStore, type RedisCommandClient } from "@/lib/domain/redis-rate-limit-store";
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

export type ActiveRateLimitStore = RateLimitStore | RedisRateLimitStore;

/** `memory` is process-local. `sqlite` uses RATE_LIMIT_SQLITE_PATH. `redis` uses REDIS_URL. */
export function openRateLimitStore(env: NodeJS.ProcessEnv = process.env): ActiveRateLimitStore {
  const backend = (env.RATE_LIMIT_BACKEND ?? "memory").trim().toLowerCase();
  if (backend === "" || backend === "memory") return new MemoryRateLimitStore();
  if (backend === "sqlite") {
    const file = env.RATE_LIMIT_SQLITE_PATH?.trim() || defaultRateLimitSqlitePath();
    return new SqliteRateLimitStore(file);
  }
  if (backend === "redis") {
    const url = env.REDIS_URL?.trim();
    if (!url) throw new Error('REDIS_URL is required when RATE_LIMIT_BACKEND=redis.');
    return new RedisRateLimitStore(openRedisClient(url) as unknown as RedisCommandClient);
  }
  throw new Error(`Unknown RATE_LIMIT_BACKEND "${backend}". Use memory, sqlite, or redis.`);
}

function openRedisClient(url: string): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2_000,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  client.on("error", () => {
    // The command promise rejects. Swallow the socket error so it does not crash the process.
  });
  return client;
}

let activeStore: ActiveRateLimitStore | undefined;

export function getRateLimitStore(): ActiveRateLimitStore {
  activeStore ??= openRateLimitStore(process.env);
  return activeStore;
}

export function resetRateLimits(): void | Promise<void> {
  return getRateLimitStore().clear();
}

/** Test hook. Pass null to rebuild from the environment on the next check. */
export function useRateLimitStore(store: ActiveRateLimitStore | null): void {
  activeStore = store ?? undefined;
}

export function enforceRateLimit(scope: keyof typeof RATE_RULES, userId: string, now = Date.now()): RateDecision {
  const store = getRateLimitStore();
  if (store instanceof RedisRateLimitStore) {
    throw new Error("RATE_LIMIT_BACKEND=redis must be checked with guardRateLimit.");
  }
  const rule = RATE_RULES[scope];
  return applyRateLimit(store, `${scope}:${userId}`, rule.limit, rule.windowMs, now);
}

/** Await a decision. A Redis outage becomes a rejected decision instead of an allowed request. */
export async function guardRateLimit(
  scope: keyof typeof RATE_RULES,
  userId: string,
  now = Date.now(),
): Promise<RateDecision> {
  const store = getRateLimitStore();
  const rule = RATE_RULES[scope];
  const key = `${scope}:${userId}`;
  try {
    if (store instanceof RedisRateLimitStore) {
      return await applyRateLimitAsync(store, key, rule.limit, rule.windowMs, now);
    }
    return applyRateLimit(store, key, rule.limit, rule.windowMs, now);
  } catch (error) {
    if (error instanceof RateLimitStoreError) {
      return { ok: false, retryAfterMs: 0, error: error.message };
    }
    throw error;
  }
}
