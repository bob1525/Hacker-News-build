import type { AsyncRateLimitStore } from "@/lib/domain/rate-limit";

/** Fail closed. Callers turn this into a visible error and do not fall back to memory. */
export class RateLimitStoreError extends Error {
  constructor(cause: unknown) {
    super("Rate limit store is unavailable. Try again shortly.");
    this.name = "RateLimitStoreError";
    this.cause = cause;
  }
}

export type RedisCommandClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string, ...keys: string[]): Promise<unknown>;
  scan(cursor: string | number, ...args: Array<string | number>): Promise<[string | number, string[]]>;
  quit(): Promise<unknown>;
  disconnect?(): void;
  status?: string;
};

/**
 * Sliding-window timestamps in Redis.
 * One process serializes decisions for the same key. Two processes can still
 * interleave GET and SET; that limit is documented in RATE_LIMIT_REDIS.md.
 */
export class RedisRateLimitStore implements AsyncRateLimitStore {
  private readonly chains = new Map<string, Promise<void>>();

  constructor(
    private readonly client: RedisCommandClient,
    private readonly prefix = "hn:rate:",
  ) {}

  async check(key: string): Promise<number[]> {
    try {
      return parseStamps(await this.client.get(this.storageKey(key)));
    } catch (error) {
      throw wrap(error);
    }
  }

  async record(key: string, stamps: readonly number[]): Promise<void> {
    const storageKey = this.storageKey(key);
    try {
      if (stamps.length === 0) {
        await this.client.del(storageKey);
        return;
      }
      await this.client.set(storageKey, JSON.stringify([...stamps]));
    } catch (error) {
      throw wrap(error);
    }
  }

  async clear(): Promise<void> {
    try {
      let cursor: string | number = "0";
      do {
        const [next, keys] = await this.client.scan(cursor, "MATCH", `${this.prefix}*`, "COUNT", 100);
        cursor = String(next);
        if (keys.length > 0) await this.client.del(keys[0], ...keys.slice(1));
      } while (cursor !== "0");
    } catch (error) {
      throw wrap(error);
    }
  }

  exclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(key) ?? Promise.resolve();
    const current = previous.then(task, task);
    this.chains.set(
      key,
      current.then(
        () => undefined,
        () => undefined,
      ),
    );
    return current;
  }

  quit(): Promise<unknown> {
    if (this.client.status === "wait" || this.client.status === "end") {
      this.client.disconnect?.();
      return Promise.resolve("OK");
    }
    return this.client.quit();
  }

  private storageKey(key: string): string {
    return `${this.prefix}${key}`;
  }
}

function parseStamps(raw: string | null): number[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new RateLimitStoreError(error);
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function wrap(error: unknown): RateLimitStoreError {
  if (error instanceof RateLimitStoreError) return error;
  return new RateLimitStoreError(error);
}
