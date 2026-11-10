declare module "ioredis-mock" {
  import type { RedisCommandClient } from "@/lib/domain/redis-rate-limit-store";

  export default class RedisMock implements RedisCommandClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<unknown>;
    del(key: string, ...keys: string[]): Promise<unknown>;
    scan(cursor: string | number, ...args: Array<string | number>): Promise<[string | number, string[]]>;
    quit(): Promise<unknown>;
    eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
  }
}
