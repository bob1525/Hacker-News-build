import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyRateLimit, consumeRateLimit, MemoryRateLimitStore } from "@/lib/domain/rate-limit";
import { SqliteRateLimitStore } from "@/lib/domain/sqlite-rate-limit-store";
import { openRateLimitStore, resetRateLimits, useRateLimitStore } from "@/lib/limits";

const script = [
  { key: "post:nash", limit: 2, windowMs: 1_000, now: 0, ok: true },
  { key: "post:nash", limit: 2, windowMs: 1_000, now: 10, ok: true },
  { key: "post:nash", limit: 2, windowMs: 1_000, now: 20, ok: false },
  { key: "post:pg", limit: 2, windowMs: 1_000, now: 20, ok: true },
  { key: "post:nash", limit: 2, windowMs: 1_000, now: 1_000, ok: true },
] as const;

describe("rate limit stores", () => {
  const files: string[] = [];

  afterEach(() => {
    useRateLimitStore(null);
    for (const file of files.splice(0)) rmSync(file, { recursive: true, force: true });
  });

  function tempFile(): string {
    const dir = mkdtempSync(path.join(tmpdir(), "hn-rate-"));
    const file = path.join(dir, "limits.db");
    files.push(dir);
    return file;
  }

  it("keeps the memory store on the same decisions as consumeRateLimit", () => {
    const buckets = new Map<string, number[]>();
    const memory = new MemoryRateLimitStore();
    for (const step of script) {
      const fromMap = consumeRateLimit(new Map(buckets), step.key, step.limit, step.windowMs, step.now);
      const fromStore = applyRateLimit(memory, step.key, step.limit, step.windowMs, step.now);
      consumeRateLimit(buckets, step.key, step.limit, step.windowMs, step.now);
      expect(fromStore.ok).toBe(step.ok);
      expect(fromStore).toEqual(fromMap);
    }
  });

  it("does not record a rejected hit in memory", () => {
    const store = new MemoryRateLimitStore();
    expect(applyRateLimit(store, "vote:nash", 1, 5_000, 0).ok).toBe(true);
    expect(applyRateLimit(store, "vote:nash", 1, 5_000, 1).ok).toBe(false);
    expect(store.check("vote:nash")).toEqual([0]);
  });

  it("persists sqlite hits across a reopened file", () => {
    const file = tempFile();
    const first = new SqliteRateLimitStore(file);
    expect(applyRateLimit(first, "post:demo", 2, 10_000, 100).ok).toBe(true);
    first.close();

    const second = new SqliteRateLimitStore(file);
    expect(second.check("post:demo")).toEqual([100]);
    expect(applyRateLimit(second, "post:demo", 2, 10_000, 200).ok).toBe(true);
    expect(applyRateLimit(second, "post:demo", 2, 10_000, 300).ok).toBe(false);
    expect(second.check("post:demo")).toEqual([100, 200]);
    second.close();
  });

  it("drops sqlite hits that have left the window and clears the table", () => {
    const file = tempFile();
    const store = new SqliteRateLimitStore(file);
    expect(applyRateLimit(store, "comment:demo", 1, 5_000, 0).ok).toBe(true);
    expect(applyRateLimit(store, "comment:demo", 1, 5_000, 4_999).ok).toBe(false);
    expect(applyRateLimit(store, "comment:demo", 1, 5_000, 5_000).ok).toBe(true);
    expect(store.check("comment:demo")).toEqual([5_000]);
    store.clear();
    expect(store.check("comment:demo")).toEqual([]);
    store.close();
  });

  it("selects memory by default and sqlite when asked", () => {
    const memory = openRateLimitStore({ ...process.env, RATE_LIMIT_BACKEND: undefined });
    expect(memory).toBeInstanceOf(MemoryRateLimitStore);

    const file = tempFile();
    const sqlite = openRateLimitStore({ ...process.env, RATE_LIMIT_BACKEND: "sqlite", RATE_LIMIT_SQLITE_PATH: file });
    expect(sqlite).toBeInstanceOf(SqliteRateLimitStore);
    if (!(sqlite instanceof SqliteRateLimitStore)) return;
    expect(applyRateLimit(sqlite, "post:demo", 1, 1_000, 0).ok).toBe(true);
    sqlite.close();

    expect(() => openRateLimitStore({ ...process.env, RATE_LIMIT_BACKEND: "not-a-backend" })).toThrow(
      /Unknown RATE_LIMIT_BACKEND/,
    );
  });

  it("resets whichever store is active", () => {
    const file = tempFile();
    const sqlite = new SqliteRateLimitStore(file);
    useRateLimitStore(sqlite);
    expect(applyRateLimit(sqlite, "vote:demo", 1, 1_000, 0).ok).toBe(true);
    resetRateLimits();
    expect(sqlite.check("vote:demo")).toEqual([]);
    sqlite.close();
  });
});
