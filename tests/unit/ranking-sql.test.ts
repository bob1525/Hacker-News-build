import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sortByHot, sortByNewest } from "@/lib/domain/ranking";
import { pageHotPostIds, pageNewestPostIds } from "@/lib/domain/ranking-sql";
import { rankingBackend } from "@/lib/ranking-backend";
import { prepareTestDatabase } from "@/tests/helpers/database";
const now = new Date("2026-11-10T12:00:00.000Z");
const hour = 3_600_000;

describe("sql hot ranking", () => {
  let db: PrismaClient;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const databaseUrl = prepareTestDatabase("ranking_sql");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
    const author = await db.user.create({
      data: { username: "author", email: "author@example.com", passwordHash: "x" },
    });

    async function post(name: string, createdAt: Date, votes: number): Promise<string> {
      const row = await db.post.create({ data: { title: name, authorId: author.id, createdAt } });
      for (let index = 0; index < votes; index += 1) {
        const voter = await db.user.create({
          data: { username: `${name}-${index}`, email: `${name}-${index}@example.com`, passwordHash: "x" },
        });
        await db.postVote.create({ data: { userId: voter.id, postId: row.id } });
      }
      return row.id;
    }

    ids.fresh = await post("fresh", new Date(now.getTime() - 0.5 * hour), 1);
    ids.oldLow = await post("old-low", new Date(now.getTime() - 48 * hour), 1);
    ids.ancientHot = await post("ancient-hot", new Date(now.getTime() - 72 * hour), 40);
    ids.newOne = await post("new-one", new Date(now.getTime() - 0.25 * hour), 1);
    ids.zero = await post("zero", new Date(now.getTime() - 2 * hour), 0);
    ids.one = await post("one", new Date(now.getTime() - 2 * hour), 1);
    const tiedAt = new Date(now.getTime() - 5 * hour);
    ids.tieA = await post("tie-a", tiedAt, 3);
    ids.tieB = await post("tie-b", tiedAt, 3);
    for (let age = 1; age <= 5; age += 1) {
      ids[`page${age}`] = await post(`page-${age}`, new Date(now.getTime() - age * hour), 1);
    }
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  async function memoryIds(selected: string[]): Promise<string[]> {
    const rows = await db.post.findMany({
      where: { id: { in: selected } },
      include: { _count: { select: { votes: true } } },
    });
    return sortByHot(
      rows.map((row) => ({ id: row.id, points: row._count.votes, createdAt: row.createdAt })),
      now,
    ).map((row) => row.id);
  }

  async function sqlIds(selected: string[], page = 1, pageSize = 30): Promise<string[]> {
    const hot = await pageHotPostIds(db, { now, page, pageSize, ids: selected });
    return hot.ids;
  }

  it("ranks a new post ahead of an older post with the same points", async () => {
    const selected = [ids.fresh, ids.oldLow];
    const ranked = await sqlIds(selected);
    expect(ranked).toEqual(await memoryIds(selected));
    expect(ranked[0]).toBe(ids.fresh);
  });

  it("lets an old post with many votes outrank a newer post with one vote", async () => {
    const selected = [ids.ancientHot, ids.newOne];
    const ranked = await sqlIds(selected);
    expect(ranked).toEqual(await memoryIds(selected));
    expect(ranked[0]).toBe(ids.ancientHot);
  });

  it("ranks a zero-vote post below a one-vote post of the same age", async () => {
    const selected = [ids.zero, ids.one];
    const ranked = await sqlIds(selected);
    expect(ranked).toEqual(await memoryIds(selected));
    expect(ranked[0]).toBe(ids.one);
  });

  it("breaks an equal score by id descending", async () => {
    const selected = [ids.tieA, ids.tieB];
    const ranked = await sqlIds(selected);
    expect(new Set(ranked)).toEqual(new Set(selected));
    expect(ranked).toEqual([...selected].sort((a, b) => b.localeCompare(a)));
    expect(new Set(await memoryIds(selected))).toEqual(new Set(selected));
  });

  it("pages without repeating or skipping posts", async () => {
    const selected = [1, 2, 3, 4, 5].map((age) => ids[`page${age}`]);
    const memory = await memoryIds(selected);
    const pages = await Promise.all(
      [1, 2, 3].map((page) => pageHotPostIds(db, { now, page, pageSize: 2, ids: selected })),
    );
    const flat = pages.flatMap((page) => page.ids);
    expect(flat).toEqual(memory);
    expect(new Set(flat).size).toBe(selected.length);
    expect(pages[0]?.hasMore).toBe(true);
    expect(pages[1]?.hasMore).toBe(true);
    expect(pages[2]?.ids).toHaveLength(1);
    expect(pages[2]?.hasMore).toBe(false);
    expect(pages[0]?.total).toBe(5);
    expect(pages[2]?.page).toBe(3);
  });

  it("orders newest posts by createdAt descending", async () => {
    const selected = [1, 2, 3, 4, 5].map((age) => ids[`page${age}`]);
    const ranked = await pageNewestPostIds(db, { page: 1, pageSize: 10, ids: selected });
    const rows = await db.post.findMany({ where: { id: { in: selected } } });
    expect(ranked.ids).toEqual(sortByNewest(rows).map((row) => row.id));
    expect(ranked.ids[0]).toBe(ids.page1);
    expect(ranked.total).toBe(5);
  });

  it("pages newest posts and breaks equal timestamps by id descending", async () => {
    const selected = [ids.tieA, ids.tieB];
    const ranked = await pageNewestPostIds(db, { page: 1, pageSize: 10, ids: selected });
    expect(ranked.ids).toEqual([...selected].sort((a, b) => b.localeCompare(a)));
    const pages = await Promise.all(
      [1, 2].map((page) => pageNewestPostIds(db, { page, pageSize: 1, ids: selected })),
    );
    expect(pages.flatMap((page) => page.ids)).toEqual(ranked.ids);
    expect(pages[0]?.hasMore).toBe(true);
    expect(pages[1]?.hasMore).toBe(false);
    expect(pages[0]?.total).toBe(2);
    expect(pages[1]?.page).toBe(2);
  });

  it("selects memory by default and sql when asked", () => {
    expect(rankingBackend({ ...process.env, RANKING_BACKEND: undefined })).toBe("memory");
    expect(rankingBackend({ ...process.env, RANKING_BACKEND: "sql" })).toBe("sql");
    expect(() => rankingBackend({ ...process.env, RANKING_BACKEND: "postgres" })).toThrow(/Unknown RANKING_BACKEND/);
  });
});
