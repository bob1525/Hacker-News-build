import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEARCH_TOKEN_MIN_LENGTH, searchRelevance, tokenize } from "@/lib/domain/search";
import { foldSearchText } from "@/lib/domain/search-fold";
import { backfillSearchFolds, countStaleSearchFolds } from "@/lib/search-fold-db";
import { prepareTestDatabase } from "@/tests/helpers/database";

const iota = "\u03B9\u0308\u0301";
const upsilon = "\u03C5\u0308\u0301";

describe("remaining full folds and short tokens", () => {
  it("expands ΐ, ΰ, and the other common full folds in foldSearchText", () => {
    expect(foldSearchText("\u0390")).toBe(iota);
    expect(foldSearchText("\u03B0")).toBe(upsilon);
    expect(foldSearchText(iota)).toBe(iota);
    expect(foldSearchText(upsilon)).toBe(upsilon);
    expect(foldSearchText("\u0149")).toBe("\u02BCn");
    expect(foldSearchText("\u01F0")).toBe("j\u030C");
    expect(foldSearchText("J\u030C")).toBe(foldSearchText("\u01F0"));
    expect(foldSearchText("\u1E96")).toBe("h\u0331");
    expect(foldSearchText("\u1E97")).toBe("t\u0308");
    expect(foldSearchText("\u1E98")).toBe("w\u030A");
    expect(foldSearchText("\u1E99")).toBe("y\u030A");
    expect(foldSearchText("\u1E9A")).toBe("a\u02BE");
    expect(foldSearchText("ß")).toBe("ss");
    expect(foldSearchText("ς")).toBe("σ");
    expect(searchRelevance({ title: "\u0390", text: "" }, iota)).toBeGreaterThan(0);
    expect(searchRelevance({ title: "\u03B0", text: "" }, upsilon)).toBeGreaterThan(0);
  });

  it("drops a folded token shorter than two characters and keeps an expanded ΐ", () => {
    expect(SEARCH_TOKEN_MIN_LENGTH).toBe(2);
    expect(foldSearchText("µ")).toBe("μ");
    expect(tokenize("µ")).toEqual([]);
    expect(tokenize("μ")).toEqual([]);
    expect(searchRelevance({ title: "µ", text: "" }, "μ")).toBe(0);
    expect(tokenize("10µm")).toEqual(["10μm"]);
    expect(searchRelevance({ title: "10µm", text: "" }, "μm")).toBeGreaterThan(0);
    expect(tokenize("\u0390")).toEqual([iota]);
    expect(tokenize("a")).toEqual([]);
  });
});

describe("search fold backfill script", () => {
  let db: PrismaClient;
  let databaseUrl = "";

  beforeAll(() => {
    databaseUrl = prepareTestDatabase("searchFoldV3");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("reports stale folds, rewrites them, and is a no-op the second time", async () => {
    const author = await db.user.create({
      data: { username: "foldv3", email: "foldv3@example.com", passwordHash: "x" },
    });
    const stale = await db.post.create({
      data: {
        title: "\u0390",
        text: "µ",
        titleFold: "\u0390",
        textFold: "µ",
        authorId: author.id,
        createdAt: new Date("2026-11-27T18:20:00.000Z"),
      },
    });
    expect(await countStaleSearchFolds(db)).toBe(1);
    expect(await backfillSearchFolds(db)).toBe(1);
    const stored = await db.post.findUniqueOrThrow({ where: { id: stale.id } });
    expect(stored.titleFold).toBe(iota);
    expect(stored.textFold).toBe("μ");
    expect(await countStaleSearchFolds(db)).toBe(0);
    expect(await backfillSearchFolds(db)).toBe(0);

    const again = execFileSync("npm", ["run", "search:backfill"], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: "utf8",
    });
    expect(again).toContain("search folds: stale 0, updated 0, stale 0");
  });
});
