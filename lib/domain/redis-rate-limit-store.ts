import type { AsyncRateLimitStore, RateDecision } from "@/lib/domain/rate-limit";

/**
 * One Redis call. Timestamps are a comma-separated list so the script does not
 * need cjson (the test mock's Lua runtime does not ship it). Real Redis runs
 * this script atomically, so two processes cannot interleave the read and write.
 */
export const RATE_LIMIT_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local raw = redis.call('GET', key)
local recent = {}
if raw and raw ~= false and raw ~= '' then
  for stamp in string.gmatch(tostring(raw), '[0-9]+') do
    local n = tonumber(stamp)
    if now - n < window then
      recent[#recent + 1] = n
    end
  end
end
local allowed = 0
local retry = 0
if #recent >= limit then
  local oldest = recent[1]
  retry = window - (now - oldest)
  if retry < 0 then
    retry = 0
  end
else
  recent[#recent + 1] = now
  allowed = 1
end
if #recent == 0 then
  redis.call('DEL', key)
else
  local parts = {}
  for i = 1, #recent do
    parts[i] = string.format('%.0f', recent[i])
  end
  redis.call('SET', key, table.concat(parts, ','))
end
return { allowed, retry }
`;

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
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
};

/**
 * Sliding-window timestamps in Redis.
 * `consume` is one EVAL, so concurrent processes cannot both pass the same slot.
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
      await this.client.set(storageKey, stamps.map((stamp) => String(stamp)).join(","));
    } catch (error) {
      throw wrap(error);
    }
  }

  async consume(key: string, limit: number, windowMs: number, now: number): Promise<RateDecision> {
    try {
      const reply = await this.client.eval(RATE_LIMIT_LUA, 1, this.storageKey(key), limit, windowMs, now);
      return decisionFromReply(reply);
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
  return raw
    .split(",")
    .map((part) => Number(part))
    .filter((value) => Number.isFinite(value));
}

function decisionFromReply(reply: unknown): RateDecision {
  const values = Array.isArray(reply) ? reply : [];
  const allowed = Number(values[0]);
  const retryAfterMs = Number(values[1]);
  if (allowed === 1) return { ok: true };
  const wait = Number.isFinite(retryAfterMs) ? Math.max(0, retryAfterMs) : 0;
  const seconds = Math.max(1, Math.ceil(wait / 1000));
  return {
    ok: false,
    retryAfterMs: wait,
    error: `Too many requests. Try again in ${seconds} seconds.`,
  };
}

function wrap(error: unknown): RateLimitStoreError {
  if (error instanceof RateLimitStoreError) return error;
  return new RateLimitStoreError(error);
}
