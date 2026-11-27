import { DatabaseSync, type StatementSync } from "node:sqlite";
import type { RateLimitStore } from "@/lib/domain/rate-limit";

/**
 * Durable sliding-window log in a SQLite file separate from the app database.
 * Each `record` replaces one key, so expired hits are dropped on the next decision.
 */
export class SqliteRateLimitStore implements RateLimitStore {
  private readonly db: DatabaseSync;
  private readonly selectHits: StatementSync;
  private readonly deleteKey: StatementSync;
  private readonly insertHit: StatementSync;
  private readonly deleteAll: StatementSync;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limit_hit (
        key TEXT NOT NULL,
        at_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS rate_limit_hit_key_at ON rate_limit_hit (key, at_ms);
    `);
    this.selectHits = this.db.prepare("SELECT at_ms FROM rate_limit_hit WHERE key = ? ORDER BY at_ms ASC");
    this.deleteKey = this.db.prepare("DELETE FROM rate_limit_hit WHERE key = ?");
    this.insertHit = this.db.prepare("INSERT INTO rate_limit_hit (key, at_ms) VALUES (?, ?)");
    this.deleteAll = this.db.prepare("DELETE FROM rate_limit_hit");
  }

  check(key: string): number[] {
    return this.selectHits.all(key).map((row) => Number(row.at_ms));
  }

  record(key: string, stamps: readonly number[]): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.deleteKey.run(key);
      for (const stamp of stamps) this.insertHit.run(key, stamp);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  clear(): void {
    this.deleteAll.run();
  }

  close(): void {
    this.db.close();
  }
}
