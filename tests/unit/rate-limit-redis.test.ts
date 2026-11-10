import { afterEach, describe, expect, it } from "vitest";
import RedisMock from "ioredis-mock";
import { applyRateLimit, applyRateLimitAsync, MemoryRateLimitStore } from "@/lib/domain/rate-limit";
import { RateLimitStoreError, RedisRateLimitStore, type RedisCommandClient } from "@/lib/domain/redis-rate-limit-store";
import { guardRateLimit, openRateLimitStore, useRateLimitStore } from "@/lib/limits";

const script = [
  { key: "post:nash", limit: 2, windowMs: 1_000, now: 0, ok: true },
  { key: "post:nash", limit: 2, windowMs: 1_000, now: 10, ok: true },
  { key: "post:nash", limit: 2, windowMs: 1_000, now: 20, ok: false },
  { key: "post:pg", limit: 2, windowMs: 1_000, now: 20, ok: true },
  { key: "post:nash", limit: 2, windowMs: 1_000, now: 1_000, ok: true },
] as const;

describe("redis rate limit store", () => {
  const stores: RedisRateLimitStore[] = [];

  afterEach(async () => {
    useRateLimitStore(null);
    await Promise.all(stores.splice(0).map((store) => store.quit()));
  });

  function mockStore(): RedisRateLimitStore {
    const store = new RedisRateLimitStore(new RedisMock());
    stores.push(store);
    return store;
  }

  it("counts the same way as the memory store", async () => {
    const memory = new MemoryRateLimitStore();
    const redis = mockStore();
    for (const step of script) {
      const fromMemory = applyRateLimit(memory, step.key, step.limit, step.windowMs, step.now);
      const fromRedis = await applyRateLimitAsync(redis, step.key, step.limit, step.windowMs, step.now);
      expect(fromRedis.ok).toBe(step.ok);
      expect(fromRedis).toEqual(fromMemory);
    }
  });

  it("drops hits that have left the window", async () => {
    const store = mockStore();
    expect((await applyRateLimitAsync(store, "comment:demo", 1, 5_000, 0)).ok).toBe(true);
    expect((await applyRateLimitAsync(store, "comment:demo", 1, 5_000, 4_999)).ok).toBe(false);
    expect((await applyRateLimitAsync(store, "comment:demo", 1, 5_000, 5_000)).ok).toBe(true);
    expect(await store.check("comment:demo")).toEqual([5_000]);
  });

  it("does not record a rejected hit", async () => {
    const store = mockStore();
    expect((await applyRateLimitAsync(store, "vote:nash", 1, 5_000, 0)).ok).toBe(true);
    const blocked = await applyRateLimitAsync(store, "vote:nash", 1, 5_000, 1);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/Too many requests/);
    expect(await store.check("vote:nash")).toEqual([0]);
  });

  it("clears every key", async () => {
    const store = mockStore();
    await applyRateLimitAsync(store, "post:demo", 2, 10_000, 10);
    await applyRateLimitAsync(store, "comment:demo", 2, 10_000, 20);
    await store.clear();
    expect(await store.check("post:demo")).toEqual([]);
    expect(await store.check("comment:demo")).toEqual([]);
  });

  it("lets only the limit through when calls overlap", async () => {
    const store = mockStore();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => applyRateLimitAsync(store, "post:nash", 4, 60_000, 1_000)),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(4);
    expect(results.filter((result) => !result.ok)).toHaveLength(6);
    expect(await store.check("post:nash")).toEqual([1_000, 1_000, 1_000, 1_000]);
  });

  it("reads redis settings and rejects a missing url", async () => {
    expect(() => openRateLimitStore({ ...process.env, RATE_LIMIT_BACKEND: "redis", REDIS_URL: undefined })).toThrow(
      /REDIS_URL is required/,
    );

    const store = openRateLimitStore({
      ...process.env,
      RATE_LIMIT_BACKEND: "redis",
      REDIS_URL: "redis://127.0.0.1:6399/0",
    });
    stores.push(store as RedisRateLimitStore);
    expect(store).toBeInstanceOf(RedisRateLimitStore);
  });

  it("rejects the action when redis cannot be reached", async () => {
    const failing: RedisCommandClient = {
      get: async () => {
        throw new Error("ECONNREFUSED");
      },
      set: async () => {
        throw new Error("ECONNREFUSED");
      },
      del: async () => 0,
      scan: async () => ["0", []],
      quit: async () => "OK",
      eval: async () => {
        throw new Error("ECONNREFUSED");
      },
    };
    const store = new RedisRateLimitStore(failing);
    await expect(applyRateLimitAsync(store, "post:demo", 1, 1_000, 0)).rejects.toBeInstanceOf(RateLimitStoreError);

    useRateLimitStore(store);
    const decision = await guardRateLimit("post", "demo", 0);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.error).toBe("Rate limit store is unavailable. Try again shortly.");
  });
});
