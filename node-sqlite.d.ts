declare module "node:sqlite" {
  export type SqlValue = null | number | string | bigint | Uint8Array;

  export interface StatementSync {
    all(...params: SqlValue[]): Record<string, SqlValue>[];
    run(...params: SqlValue[]): { changes: number };
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
