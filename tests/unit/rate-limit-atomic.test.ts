import { afterEach, describe, expect, it } from "vitest";
import RedisMock from "ioredis-mock";
import { applyRateLimitAsync } from "@/lib/domain/rate-limit";
import { RATE_LIMIT_LUA, RedisRateLimitStore } from "@/lib/domain/redis-rate-limit-store";

describe("atomic redis rate limit", () => {
  const stores: RedisRateLimitStore[] = [];

  afterEach(async () => {
    await Promise.all(stores.splice(0).map((store) => store.quit()));
  });

  function pair(): [RedisRateLimitStore, RedisRateLimitStore] {
    const client = new RedisMock();
    const first = new RedisRateLimitStore(client);
    const second = new RedisRateLimitStore(client);
    stores.push(first, second);
    return [first, second];
  }

  it("keeps the script in one EVAL", () => {
    expect(RATE_LIMIT_LUA).toMatch(/redis\.call\('GET'/);
    expect(RATE_LIMIT_LUA).toMatch(/redis\.call\('SET'/);
    expect(RATE_LIMIT_LUA).not.toMatch(/cjson/);
  });

  it("lets two stores share one limit when calls overlap", async () => {
    const [first, second] = pair();
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) => {
        const store = index % 2 === 0 ? first : second;
        return applyRateLimitAsync(store, "post:nash", 3, 60_000, 1_000);
      }),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(results.filter((result) => !result.ok)).toHaveLength(9);
    expect(await first.check("post:nash")).toEqual([1_000, 1_000, 1_000]);
    expect(await second.check("post:nash")).toEqual([1_000, 1_000, 1_000]);
  });

  it("does not append a stamp when the overlapping call is rejected", async () => {
    const [first, second] = pair();
    await applyRateLimitAsync(first, "vote:demo", 1, 5_000, 0);
    const blocked = await Promise.all([
      applyRateLimitAsync(first, "vote:demo", 1, 5_000, 10),
      applyRateLimitAsync(second, "vote:demo", 1, 5_000, 20),
    ]);
    expect(blocked.every((result) => !result.ok)).toBe(true);
    expect(await first.check("vote:demo")).toEqual([0]);
  });

  it("does not let one key consume another key's budget", async () => {
    const [first, second] = pair();
    const results = await Promise.all([
      ...Array.from({ length: 4 }, () => applyRateLimitAsync(first, "post:a", 2, 60_000, 50)),
      ...Array.from({ length: 4 }, () => applyRateLimitAsync(second, "post:b", 2, 60_000, 50)),
    ]);
    const allowedA = results.slice(0, 4).filter((result) => result.ok);
    const allowedB = results.slice(4).filter((result) => result.ok);
    expect(allowedA).toHaveLength(2);
    expect(allowedB).toHaveLength(2);
    expect(await first.check("post:a")).toEqual([50, 50]);
    expect(await second.check("post:b")).toEqual([50, 50]);
  });
});
