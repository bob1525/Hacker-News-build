import { describe, expect, it } from "vitest";
import { searchRelevance, sortSearchResults, tokenize } from "@/lib/domain/search";

const now = new Date("2026-11-10T00:00:00Z");

describe("search", () => {
  it("tokenizes case-insensitively and drops one-character noise", () => {
    expect(tokenize("  SQLite, WAL ")).toEqual(["sqlite", "wal"]);
    expect(tokenize("a")).toEqual([]);
    expect(tokenize("C++")).toEqual([]);
    expect(tokenize("阅读 笔记")).toEqual(["阅读", "笔记"]);
  });

  it("ranks a title match above a body mention", () => {
    const title = searchRelevance({ title: "Ferrocene toolchain", text: "" }, "ferrocene");
    const body = searchRelevance({ title: "A compiler note", text: "We mentioned ferrocene once." }, "ferrocene");
    expect(title).toBeGreaterThan(body);
  });

  it("uses hot score only as a tie break", () => {
    const ranked = sortSearchResults(
      [
        {
          title: "Older sqlite note",
          text: "sqlite",
          points: 40,
          createdAt: new Date(now.getTime() - 2 * 3_600_000),
        },
        {
          title: "Newer sqlite note",
          text: "sqlite",
          points: 40,
          createdAt: new Date(now.getTime() - 1 * 3_600_000),
        },
        {
          title: "Unrelated",
          text: "databases",
          points: 100,
          createdAt: now,
        },
      ],
      "sqlite",
      now,
    );
    expect(ranked.map((post) => post.title)).toEqual(["Newer sqlite note", "Older sqlite note", "Unrelated"]);
  });
});
