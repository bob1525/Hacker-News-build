import { afterEach, describe, expect, it } from "vitest";
import Redis from "ioredis";
import { applyRateLimitAsync } from "@/lib/domain/rate-limit";
import { RedisRateLimitStore, type RedisCommandClient } from "@/lib/domain/redis-rate-limit-store";

const live = process.env.REDIS_INTEGRATION === "1" && Boolean(process.env.REDIS_URL);
const stores: RedisRateLimitStore[] = [];

describe.skipIf(!live)("redis service rate limit", () => {
  afterEach(async () => {
    await Promise.all(stores.splice(0).map((store) => store.clear().then(() => store.quit())));
  });

  function open(prefix: string): RedisRateLimitStore {
    const client = new Redis(process.env.REDIS_URL ?? "", {
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      lazyConnect: false,
    });
    const store = new RedisRateLimitStore(client as unknown as RedisCommandClient, prefix);
    stores.push(store);
    return store;
  }

  it("shares one EVAL limit across two connections to the server", async () => {
    const prefix = `hn:rate:live:${process.pid}:`;
    const first = open(prefix);
    const second = open(prefix);
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) => {
        const store = index % 2 === 0 ? first : second;
        return applyRateLimitAsync(store, "post:live", 2, 60_000, 1_000);
      }),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(2);
    expect(results.filter((result) => !result.ok)).toHaveLength(4);
    expect(await first.check("post:live")).toEqual([1_000, 1_000]);
    expect(await second.check("post:live")).toEqual([1_000, 1_000]);
  });
});
