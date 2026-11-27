import { describe, expect, it } from "vitest";
import { searchPostSql, sqlDialect } from "@/lib/sql-dialect";

describe("sql dialect", () => {
  it("keeps the sqlite search predicate", () => {
    expect(searchPostSql(1, "sqlite")).toBe(
      "SELECT id FROM Post WHERE (instr(titleFold, ?) > 0 OR instr(ifnull(textFold, ''), ?) > 0)",
    );
    expect(searchPostSql(2, "sqlite")).toContain("AND");
  });

  it("uses quoted identifiers and numbered placeholders on postgresql", () => {
    expect(searchPostSql(1, "postgresql")).toBe(
      `SELECT "id" FROM "Post" WHERE (strpos("titleFold", $1) > 0 OR strpos(COALESCE("textFold", ''), $2) > 0)`,
    );
  });

  it("reads the dialect from DATABASE_URL", () => {
    expect(sqlDialect({ DATABASE_URL: "file:./dev.db" })).toBe("sqlite");
    expect(sqlDialect({ DATABASE_URL: "postgresql://hn:hn@localhost:5432/hackernews" })).toBe("postgresql");
    expect(sqlDialect({})).toBe("sqlite");
  });
});
