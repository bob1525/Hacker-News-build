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
import { consumeRateLimit, type RateBucket, type RateDecision } from "@/lib/domain/rate-limit";

export const RATE_RULES = {
  post: { limit: POST_RATE_LIMIT, windowMs: POST_RATE_WINDOW_MS },
  comment: { limit: COMMENT_RATE_LIMIT, windowMs: COMMENT_RATE_WINDOW_MS },
  vote: { limit: VOTE_RATE_LIMIT, windowMs: VOTE_RATE_WINDOW_MS },
} as const;

export { POST_DUPLICATE_WINDOW_MS, COMMENT_DUPLICATE_WINDOW_MS };

const buckets: RateBucket = new Map();

export function resetRateLimits(): void {
  buckets.clear();
}

export function enforceRateLimit(scope: keyof typeof RATE_RULES, userId: string, now = Date.now()): RateDecision {
  const rule = RATE_RULES[scope];
  return consumeRateLimit(buckets, `${scope}:${userId}`, rule.limit, rule.windowMs, now);
}
