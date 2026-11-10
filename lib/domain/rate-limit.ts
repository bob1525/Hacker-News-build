export type RateBucket = Map<string, number[]>;

export type RateDecision =
  | { ok: true }
  | { ok: false; retryAfterMs: number; error: string };

/** Check the timestamps already stored for a key, and record the timestamps that should remain. */
export interface RateLimitStore {
  check(key: string): number[];
  record(key: string, stamps: readonly number[]): void;
  clear(): void;
}

/**
 * Sliding window over a store. A rejected call does not consume a slot.
 * `now` is injectable so tests can move the clock.
 */
export function applyRateLimit(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): RateDecision {
  const recent = store.check(key).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    const oldest = recent[0] ?? now;
    const retryAfterMs = Math.max(0, windowMs - (now - oldest));
    store.record(key, recent);
    const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return {
      ok: false,
      retryAfterMs,
      error: `Too many requests. Try again in ${seconds} seconds.`,
    };
  }
  recent.push(now);
  store.record(key, recent);
  return { ok: true };
}

export class MemoryRateLimitStore implements RateLimitStore {
  constructor(private readonly buckets: RateBucket = new Map()) {}

  check(key: string): number[] {
    return [...(this.buckets.get(key) ?? [])];
  }

  record(key: string, stamps: readonly number[]): void {
    this.buckets.set(key, [...stamps]);
  }

  clear(): void {
    this.buckets.clear();
  }
}

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
  return applyRateLimit(new MemoryRateLimitStore(buckets), key, limit, windowMs, now);
}
