import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pageSearchResults } from "@/lib/domain/search";
import { searchPostSql } from "@/lib/sql-dialect";
import { prepareTestDatabase } from "@/tests/helpers/database";

const now = new Date("2026-11-10T12:00:00.000Z");
const hour = 3_600_000;

describe("search candidate prefilter", () => {
  let db: PrismaClient;

  beforeAll(() => {
    const databaseUrl = prepareTestDatabase("search");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  async function idsFor(query: string): Promise<string[]> {
    const words = query.split(" ");
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(searchPostSql(words.length), ...words.flatMap((word) => [word, word]));
    return rows.map((row) => row.id);
  }

  it("keeps only posts that contain every word before scoring", async () => {
    const author = await db.user.create({
      data: { username: "author", email: "author@example.com", passwordHash: "x" },
    });
    const both = await db.post.create({
      data: { title: "SQLite WAL notes", text: "", authorId: author.id },
    });
    const one = await db.post.create({
      data: { title: "Hello", text: "sqlite only", authorId: author.id },
    });
    await db.post.create({
      data: { title: "Other", text: "nothing here", authorId: author.id },
    });

    const bothWords = await idsFor("sqlite wal");
    expect(bothWords).toEqual([both.id]);

    const oneWord = await idsFor("sqlite");
    expect(new Set(oneWord)).toEqual(new Set([both.id, one.id]));
  });
});

describe("search pagination", () => {
  it("pages the scored candidates without repeats or gaps", () => {
    const posts = [0, 1, 2, 3, 4].map((age) => ({
      id: `page-${age}`,
      title: `sqlite note ${age}`,
      text: "sqlite",
      points: 1,
      createdAt: new Date(now.getTime() - age * hour),
    }));
    const pages = [1, 2, 3].map((page) => pageSearchResults(posts, "sqlite", page, 2, now));
    const flat = pages.flatMap((page) => page.items.map((item) => item.id));
    expect(flat).toEqual(["page-0", "page-1", "page-2", "page-3", "page-4"]);
    expect(new Set(flat).size).toBe(posts.length);
    expect(pages[0]?.hasMore).toBe(true);
    expect(pages[2]?.items).toHaveLength(1);
    expect(pages[2]?.hasMore).toBe(false);
    expect(pages[2]?.total).toBe(5);
    expect(pageSearchResults(posts, "sqlite", 4, 2, now).items).toEqual([]);
  });

  it("breaks equal relevance and hot score by id descending", () => {
    const createdAt = new Date(now.getTime() - hour);
    const posts = ["b", "a"].map((id) => ({
      id,
      title: "sqlite note",
      text: "sqlite",
      points: 2,
      createdAt,
    }));
    expect(pageSearchResults(posts, "sqlite", 1, 10, now).items.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
