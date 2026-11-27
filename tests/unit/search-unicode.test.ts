import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { searchRelevance } from "@/lib/domain/search";
import { foldSearchText, withSearchFold } from "@/lib/domain/search-fold";
import { searchPostSql } from "@/lib/sql-dialect";
import { backfillSearchFolds } from "@/lib/search-fold-db";
import { loadSearchWindow } from "@/lib/search-window-db";
import { prepareTestDatabase } from "@/tests/helpers/database";

const now = new Date("2026-11-27T13:20:00.000Z");

describe("search case fold", () => {
  it("folds composed and uppercase non-ASCII the same way", () => {
    expect(foldSearchText("CAF\u00c9")).toBe(foldSearchText("cafe\u0301"));
    expect(foldSearchText("\u03a9MEGA")).toBe(foldSearchText("\u03c9mega"));
    expect(foldSearchText("\u03a9MEGA")).toBe("\u03c9mega");
    const upper = searchRelevance({ title: "CAF\u00c9 menu", text: "" }, "cafe\u0301");
    const composed = searchRelevance({ title: "caf\u00e9 menu", text: "" }, "CAF\u00c9");
    expect(upper).toBe(composed);
    expect(upper).toBeGreaterThan(0);
    expect(searchRelevance({ title: "note", text: "\u03a9MEGA inside" }, "\u03c9mega")).toBeLessThan(upper);
  });

  it("does not ask SQL to call lower", () => {
    expect(searchPostSql(1, "sqlite")).not.toContain("lower(");
    expect(searchPostSql(1, "postgresql")).not.toContain("lower(");
    expect(searchPostSql(1, "sqlite")).toContain("titleFold");
    expect(searchPostSql(1, "postgresql")).toContain('"titleFold"');
  });
});

describe("non-ASCII search rows", () => {
  let db: PrismaClient;

  beforeAll(() => {
    const databaseUrl = prepareTestDatabase("searchUnicode");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("finds a folded title through the search window and repairs an old row", async () => {
    const author = await db.user.create({
      data: { username: "unicode", email: "unicode@example.com", passwordHash: "x" },
    });
    const cafe = await db.post.create({
      data: withSearchFold({
        title: "CAF\u00c9 menu",
        text: "\u6b63\u6587\u7b14\u8bb0",
        authorId: author.id,
        createdAt: now,
      }),
    });
    const greek = await db.post.create({
      data: {
        title: "\u03a9MEGA notes",
        text: "plain",
        titleFold: "",
        textFold: "",
        authorId: author.id,
        createdAt: now,
      },
    });

    const before = await loadSearchWindow(db, { query: "\u03c9mega", page: 1, pageSize: 10, now });
    expect(before.items.map((item) => item.id)).toEqual([]);
    expect(await backfillSearchFolds(db)).toBe(1);

    const greekHits = await loadSearchWindow(db, { query: "\u03c9mega", page: 1, pageSize: 10, now });
    expect(greekHits.total).toBe(1);
    expect(greekHits.items.map((item) => item.id)).toEqual([greek.id]);
    expect(searchRelevance({ title: greek.title, text: greek.text }, "\u03c9mega")).toBeGreaterThan(0);

    const cafeHits = await loadSearchWindow(db, { query: "cafe\u0301", page: 1, pageSize: 10, now });
    expect(cafeHits.items.map((item) => item.id)).toEqual([cafe.id]);
    const notes = await loadSearchWindow(db, { query: "\u7b14\u8bb0", page: 1, pageSize: 10, now });
    expect(notes.items.map((item) => item.id)).toEqual([cafe.id]);
    expect(notes.scored).toBe(1);
  });
});
