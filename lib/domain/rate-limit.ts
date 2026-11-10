export type RateBucket = Map<string, number[]>;

export type RateDecision =
  | { ok: true }
  | { ok: false; retryAfterMs: number; error: string };

/**
 * Sliding window counter. `now` is injectable so tests can move the clock.
 * A rejected call does not consume a slot.
 */
export function consumeRateLimit(
  buckets: RateBucket,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): RateDecision {
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    const oldest = recent[0] ?? now;
    const retryAfterMs = Math.max(0, windowMs - (now - oldest));
    buckets.set(key, recent);
    const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return {
      ok: false,
      retryAfterMs,
      error: `Too many requests. Try again in ${seconds} seconds.`,
    };
  }
  recent.push(now);
  buckets.set(key, recent);
  return { ok: true };
}
