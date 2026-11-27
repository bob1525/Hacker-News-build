import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { searchRelevance } from "@/lib/domain/search";
import { foldSearchText, withSearchFold } from "@/lib/domain/search-fold";
import { backfillSearchFolds } from "@/lib/search-fold-db";
import { loadSearchWindow } from "@/lib/search-window-db";
import { searchPostSql } from "@/lib/sql-dialect";
import { prepareTestDatabase } from "@/tests/helpers/database";

const now = new Date("2026-11-27T18:00:00.000Z");

describe("full case fold gaps", () => {
  it("expands ligatures, the micro sign, kelvin, and angstrom in foldSearchText only", () => {
    expect(foldSearchText("ﬁle")).toBe("file");
    expect(foldSearchText("ﬂow")).toBe("flow");
    expect(foldSearchText("ﬀ")).toBe("ff");
    expect(foldSearchText("ﬃ")).toBe("ffi");
    expect(foldSearchText("ﬄ")).toBe("ffl");
    expect(foldSearchText("ﬅ")).toBe("st");
    expect(foldSearchText("ﬆ")).toBe("st");
    expect(foldSearchText("µ")).toBe("μ");
    expect(foldSearchText("µ")).toBe(foldSearchText("μ"));
    expect(foldSearchText("10 K")).toBe(foldSearchText("10 k"));
    expect(foldSearchText("K")).toBe("k");
    expect(foldSearchText("Å")).toBe(foldSearchText("Å"));
    expect(foldSearchText("Å")).toBe("å");
    expect(foldSearchText("ſ")).toBe("s");
    expect(foldSearchText("ß")).toBe("ss");
    expect(foldSearchText("ẞ")).toBe("ss");
    expect(foldSearchText("ς")).toBe("σ");
    expect(foldSearchText("Σ")).toBe("σ");

    const ligature = searchRelevance({ title: "ﬁle", text: "" }, "FILE");
    const ascii = searchRelevance({ title: "file", text: "" }, "ﬁle");
    expect(ligature).toBe(ascii);
    expect(ligature).toBeGreaterThan(0);
    expect(searchRelevance({ title: "10µm", text: "" }, "μm")).toBeGreaterThan(0);
    expect(searchPostSql(1, "sqlite")).not.toContain("lower(");
    expect(searchPostSql(1, "postgresql")).not.toContain("lower(");
    expect(searchPostSql(1, "sqlite")).not.toContain("ﬁ");
    expect(searchPostSql(1, "postgresql")).not.toContain("µ");
  });
});

describe("backfill rewrites ligature and micro folds", () => {
  let db: PrismaClient;

  beforeAll(() => {
    const databaseUrl = prepareTestDatabase("searchCasefold");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("finds a query only after the stored fold is rewritten", async () => {
    const author = await db.user.create({
      data: { username: "casefold", email: "casefold@example.com", passwordHash: "x" },
    });
    const fresh = await db.post.create({
      data: withSearchFold({
        title: "file cabinet",
        text: "plain",
        authorId: author.id,
        createdAt: now,
      }),
    });
    const ligature = await db.post.create({
      data: {
        title: "ﬁle",
        text: "old ligature",
        titleFold: "ﬁle",
        textFold: "old ligature",
        authorId: author.id,
        createdAt: now,
      },
    });
    const micro = await db.post.create({
      data: {
        title: "10µm",
        text: "",
        titleFold: "",
        textFold: "",
        authorId: author.id,
        createdAt: now,
      },
    });

    const before = await loadSearchWindow(db, { query: "file", page: 1, pageSize: 10, now });
    expect(before.items.map((item) => item.id)).toEqual([fresh.id]);

    expect(await backfillSearchFolds(db)).toBe(2);
    const stored = await db.post.findUniqueOrThrow({ where: { id: ligature.id } });
    expect(stored.titleFold).toBe("file");
    expect(stored.textFold).toBe("old ligature");
    expect((await db.post.findUniqueOrThrow({ where: { id: micro.id } })).titleFold).toBe(foldSearchText("10µm"));

    const after = await loadSearchWindow(db, { query: "file", page: 1, pageSize: 10, now });
    expect(new Set(after.items.map((item) => item.id))).toEqual(new Set([fresh.id, ligature.id]));
    const microns = await loadSearchWindow(db, { query: "μm", page: 1, pageSize: 10, now });
    expect(microns.items.map((item) => item.id)).toEqual([micro.id]);
  });
});
