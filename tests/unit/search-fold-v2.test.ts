import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { searchRelevance } from "@/lib/domain/search";
import { foldSearchText, withSearchFold } from "@/lib/domain/search-fold";
import { backfillSearchFolds } from "@/lib/search-fold-db";
import { loadSearchWindow } from "@/lib/search-window-db";
import { searchPostSql } from "@/lib/sql-dialect";
import { prepareTestDatabase } from "@/tests/helpers/database";

const now = new Date("2026-11-27T14:00:00.000Z");

describe("sharper search case fold", () => {
  it("folds ß and SS to the same letters, including capital eszett", () => {
    expect(foldSearchText("ß")).toBe("ss");
    expect(foldSearchText("SS")).toBe("ss");
    expect(foldSearchText("ss")).toBe("ss");
    expect(foldSearchText("Ss")).toBe("ss");
    expect(foldSearchText("ẞ")).toBe("ss");
    expect(foldSearchText("Straße")).toBe(foldSearchText("STRASSE"));
    expect(foldSearchText("Straße")).toBe("strasse");
    expect(foldSearchText("ς")).toBe(foldSearchText("Σ"));
    expect(foldSearchText("ς")).toBe("σ");
  });

  it("keeps ASCII and already-covered non-ASCII folds", () => {
    expect(foldSearchText("Hello")).toBe("hello");
    expect(foldSearchText("CAFÉ")).toBe(foldSearchText("cafe\u0301"));
    expect(foldSearchText("ΩMEGA")).toBe("ωmega");
    const sharp = searchRelevance({ title: "Straße", text: "" }, "SS");
    const ascii = searchRelevance({ title: "STRASSE", text: "" }, "ß");
    expect(sharp).toBe(ascii);
    expect(sharp).toBeGreaterThan(0);
    expect(searchPostSql(1, "sqlite")).not.toContain("lower(");
    expect(searchPostSql(1, "postgresql")).not.toContain("lower(");
  });
});

describe("stored folds for eszett", () => {
  let db: PrismaClient;

  beforeAll(() => {
    const databaseUrl = prepareTestDatabase("searchFold");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("finds ß with SS and rewrites a stale or empty fold", async () => {
    const author = await db.user.create({
      data: { username: "fold", email: "fold@example.com", passwordHash: "x" },
    });
    const fresh = await db.post.create({
      data: withSearchFold({
        title: "STRASSE map",
        text: "plain",
        authorId: author.id,
        createdAt: now,
      }),
    });
    const stale = await db.post.create({
      data: {
        title: "Straße",
        text: "old fold",
        titleFold: "straße",
        textFold: "old fold",
        authorId: author.id,
        createdAt: now,
      },
    });
    const empty = await db.post.create({
      data: {
        title: "große",
        text: "",
        titleFold: "",
        textFold: "",
        authorId: author.id,
        createdAt: now,
      },
    });

    const before = await loadSearchWindow(db, { query: "SS", page: 1, pageSize: 10, now });
    expect(before.items.map((item) => item.id)).toEqual([fresh.id]);

    expect(await backfillSearchFolds(db)).toBe(2);
    const stored = await db.post.findUniqueOrThrow({ where: { id: stale.id } });
    expect(stored.titleFold).toBe("strasse");
    expect(stored.textFold).toBe("old fold");

    const after = await loadSearchWindow(db, { query: "ß", page: 1, pageSize: 10, now });
    expect(after.total).toBe(3);
    expect(new Set(after.items.map((item) => item.id))).toEqual(new Set([fresh.id, stale.id, empty.id]));
    expect(searchRelevance({ title: stale.title, text: stale.text }, "SS")).toBeGreaterThan(0);
  });
});
