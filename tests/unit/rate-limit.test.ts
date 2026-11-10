import { describe, expect, it } from "vitest";
import { COMMENT_RATE_LIMIT, POST_RATE_LIMIT, VOTE_RATE_LIMIT } from "@/lib/config";
import { consumeRateLimit } from "@/lib/domain/rate-limit";
import { enforceRateLimit, resetRateLimits } from "@/lib/limits";

describe("rate limits", () => {
  it("allows a burst up to the limit and rejects the next call", () => {
    const buckets = new Map<string, number[]>();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(consumeRateLimit(buckets, "post:nash", 5, 60_000, 1_000).ok).toBe(true);
    }
    const blocked = consumeRateLimit(buckets, "post:nash", 5, 60_000, 1_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toMatch(/Too many requests/);
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("does not consume a slot when the call is rejected", () => {
    const buckets = new Map<string, number[]>();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      consumeRateLimit(buckets, "vote:nash", 2, 10_000, 0);
    }
    expect(consumeRateLimit(buckets, "vote:nash", 2, 10_000, 1).ok).toBe(false);
    expect(consumeRateLimit(buckets, "vote:nash", 2, 10_000, 10_000).ok).toBe(true);
  });

  it("opens the window again after it expires", () => {
    const buckets = new Map<string, number[]>();
    expect(consumeRateLimit(buckets, "comment:nash", 1, 5_000, 0).ok).toBe(true);
    expect(consumeRateLimit(buckets, "comment:nash", 1, 5_000, 4_999).ok).toBe(false);
    expect(consumeRateLimit(buckets, "comment:nash", 1, 5_000, 5_000).ok).toBe(true);
  });

  it("keeps users and actions on separate counters", () => {
    const buckets = new Map<string, number[]>();
    expect(consumeRateLimit(buckets, "post:nash", 1, 60_000, 0).ok).toBe(true);
    expect(consumeRateLimit(buckets, "post:nash", 1, 60_000, 0).ok).toBe(false);
    expect(consumeRateLimit(buckets, "post:pg", 1, 60_000, 0).ok).toBe(true);
    expect(consumeRateLimit(buckets, "comment:nash", 1, 60_000, 0).ok).toBe(true);
  });

  it("enforces the production post, comment, and vote ceilings", () => {
    resetRateLimits();
    const now = 50_000;
    for (let attempt = 0; attempt < POST_RATE_LIMIT; attempt += 1) {
      expect(enforceRateLimit("post", "demo", now).ok).toBe(true);
    }
    expect(enforceRateLimit("post", "demo", now).ok).toBe(false);
    expect(enforceRateLimit("post", "lurker", now).ok).toBe(true);

    for (let attempt = 0; attempt < COMMENT_RATE_LIMIT; attempt += 1) {
      expect(enforceRateLimit("comment", "demo", now).ok).toBe(true);
    }
    expect(enforceRateLimit("comment", "demo", now).ok).toBe(false);

    for (let attempt = 0; attempt < VOTE_RATE_LIMIT; attempt += 1) {
      expect(enforceRateLimit("vote", "demo", now).ok).toBe(true);
    }
    const blocked = enforceRateLimit("vote", "demo", now);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/Try again in/);
    resetRateLimits();
  });
});
