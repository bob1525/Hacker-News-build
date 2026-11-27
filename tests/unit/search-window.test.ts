import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pageSearchResults, searchRelevance } from "@/lib/domain/search";
import { searchGroupStatement } from "@/lib/domain/search-sql";
import { relevanceFromFeatures, searchFeatures, searchWindow, type SearchHit } from "@/lib/domain/search-window";
import { loadSearchWindow, readSearchGroup } from "@/lib/search-window-db";
import { prepareTestDatabase } from "@/tests/helpers/database";

const now = new Date("2026-11-27T12:00:00.000Z");
const hour = 3_600_000;

function hit(id: string, title: string, text: string, points: number, ageHours: number): SearchHit {
  return { id, title, text, points, createdAt: new Date(now.getTime() - ageHours * hour) };
}

describe("search window", () => {
  it("scores only the rows needed for the page and keeps the full order", () => {
    const posts = [
      hit("body-0", "note", "needle sits in the body", 1, 1),
      hit("body-1", "note", "another needle", 9, 1),
      hit("body-2", "note", "needle again", 3, 2),
      hit("body-3", "note", "needle later", 1, 4),
      hit("exact-hot", "needle", "", 4, 1),
      hit("exact-new", "needle", "needle", 1, 0),
    ];
    const first = searchWindow(posts, "needle", 1, 2, now);
    const full = pageSearchResults(posts, "needle", 1, 30, now);
    expect(first.scored).toBe(2);
    expect(first.scored).toBeLessThan(first.total);
    expect(first.items.map((item) => item.id)).toEqual(full.items.slice(0, 2).map((item) => item.id));
    expect(first.hasMore).toBe(true);

    const second = searchWindow(posts, "needle", 2, 2, now);
    expect(second.items.map((item) => item.id)).toEqual(full.items.slice(2, 4).map((item) => item.id));
    const seen = [...first.items, ...second.items].map((item) => item.id);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("uses searchRelevance for every feature group a candidate can hit", () => {
    const titles = ["needle", "needle extra", "wal needle", "plain", "needlewal", "§"];
    const texts = ["", "needle", "needle wal", "wal only", "extra needle text"];
    for (const title of titles) {
      for (const text of texts) {
        const features = searchFeatures({ title, text }, "needle wal");
        if (!features) continue;
        expect(relevanceFromFeatures(features, "needle wal")).toBe(searchRelevance({ title, text }, "needle wal"));
      }
    }
  });
});

describe("search group columns", () => {
  it("keeps Postgres aliases quoted and reads folded names", () => {
    const sql = searchGroupStatement(["needle"], "postgresql").sql;
    expect(sql).toContain('AS "titleCount"');
    expect(sql).toContain('AS "exactMatch"');
    expect(readSearchGroup({ exactmatch: 0, titlephrase: 0, textphrase: 1, titlecount: 0, textcount: 1 })).toEqual({
      exact: false,
      titlePhrase: false,
      textPhrase: true,
      titleCount: 0,
      textCount: 1,
    });
    expect(relevanceFromFeatures({ exact: false, titlePhrase: false, textPhrase: true, titleCount: 0, textCount: 1 }, "needle")).toBe(
      searchRelevance({ title: "§", text: "needle" }, "needle"),
    );
  });
});

describe("search window sql", () => {
  let db: PrismaClient;

  beforeAll(() => {
    const databaseUrl = prepareTestDatabase("searchWindow");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("does not score body matches once title matches fill the page", async () => {
    const author = await db.user.create({
      data: { username: "window", email: "window@example.com", passwordHash: "x" },
    });
    const created: SearchHit[] = [];
    for (let index = 0; index < 5; index += 1) {
      const post = await db.post.create({
        data: {
          title: "note",
          text: "needle sits in the body",
          authorId: author.id,
          createdAt: new Date(now.getTime() - (index + 1) * hour),
        },
      });
      if (index === 0) {
        await db.postVote.create({ data: { userId: author.id, postId: post.id, value: 3 } });
      }
      created.push({ id: post.id, title: post.title, text: post.text, points: index === 0 ? 3 : 0, createdAt: post.createdAt });
    }
    const hot = await db.post.create({
      data: { title: "needle", text: "", authorId: author.id, createdAt: new Date(now.getTime() - hour) },
    });
    await db.postVote.create({ data: { userId: author.id, postId: hot.id, value: 2 } });
    const newer = await db.post.create({
      data: { title: "needle", text: "needle", authorId: author.id, createdAt: now },
    });
    created.push(
      { id: hot.id, title: "needle", text: "", points: 2, createdAt: hot.createdAt },
      { id: newer.id, title: "needle", text: "needle", points: 0, createdAt: newer.createdAt },
    );

    const loaded = await loadSearchWindow(db, { query: "needle", page: 1, pageSize: 2, now });
    const full = pageSearchResults(created, "needle", 1, 2, now);
    expect(loaded.scored).toBe(2);
    expect(loaded.total).toBe(created.length);
    expect(loaded.items.map((item) => item.id)).toEqual(full.items.map((item) => item.id));
    expect(loaded.hasMore).toBe(true);

    const phrase = await db.post.create({
      data: { title: "needle wal", text: "notes", authorId: author.id, createdAt: now },
    });
    await db.post.create({
      data: { title: "note", text: "wal then needle", authorId: author.id, createdAt: now },
    });
    const both = await loadSearchWindow(db, { query: "needle wal", page: 1, pageSize: 1, now });
    expect(both.total).toBe(2);
    expect(both.scored).toBe(1);
    expect(both.items.map((item) => item.id)).toEqual([phrase.id]);
  });
});
