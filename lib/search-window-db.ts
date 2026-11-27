import type { PrismaClient } from "@prisma/client";
import type { Page } from "@/lib/domain/pagination";
import { pageHotPostIds } from "@/lib/domain/ranking-sql";
import { sortSearchResults, tokenize } from "@/lib/domain/search";
import { searchGroupStatement, searchHotExtra } from "@/lib/domain/search-sql";
import {
  relevanceFromFeatures,
  sameSearchFeatures,
  searchFeatures,
  type SearchFeatures,
  type SearchHit,
} from "@/lib/domain/search-window";
import { sqlDialect } from "@/lib/sql-dialect";
import type { FeedFilter } from "@/lib/types";

type GroupRow = {
  exactMatch: number | bigint;
  titlePhrase: number | bigint;
  textPhrase: number | bigint;
  titleCount: number | bigint;
  textCount: number | bigint;
  total: number | bigint;
};

function column(row: Record<string, unknown>, name: string): number {
  const value = row[name] ?? row[name.toLowerCase()];
  const numeric = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Search group column ${name} was missing.`);
  }
  return numeric;
}

/** Postgres folds unquoted aliases. Quoted aliases stay mixed-case; accept either. */
export function readSearchGroup(row: Record<string, unknown>): SearchFeatures {
  return {
    exact: column(row, "exactMatch") === 1,
    titlePhrase: column(row, "titlePhrase") === 1,
    textPhrase: column(row, "textPhrase") === 1,
    titleCount: column(row, "titleCount"),
    textCount: column(row, "textCount"),
  };
}

/**
 * Load and score only the rows required for this results page.
 * SQL groups posts by the same title/text features `searchRelevance` reads.
 * It does not add a second score. Hot order inside a tied score uses the existing ranking query.
 */
export async function loadSearchWindow(
  db: PrismaClient,
  options: {
    query: string;
    page: number;
    pageSize: number;
    now?: Date;
    filter?: FeedFilter;
    authorIds?: string[];
  },
): Promise<Page<SearchHit> & { scored: number }> {
  const size = Number.isFinite(options.pageSize) && options.pageSize > 0 ? Math.floor(options.pageSize) : 1;
  const page = Number.isInteger(options.page) && options.page > 0 ? options.page : 1;
  const now = options.now ?? new Date();
  const words = tokenize(options.query);
  if (words.length === 0 || (options.authorIds && options.authorIds.length === 0)) {
    return { items: [], page, hasMore: false, total: 0, scored: 0 };
  }

  const dialect = sqlDialect();
  const grouped = searchGroupStatement(words, dialect, { filter: options.filter, authorIds: options.authorIds });
  const rows = await db.$queryRawUnsafe<GroupRow[]>(grouped.sql, ...grouped.params);
  const groups = rows
    .map((row) => ({
      features: readSearchGroup(row as unknown as Record<string, unknown>),
      total: column(row as unknown as Record<string, unknown>, "total"),
    }))
    .filter((group) => group.total > 0)
    .map((group) => ({ ...group, score: relevanceFromFeatures(group.features, options.query) }))
    .sort((a, b) => b.score - a.score);

  const total = groups.reduce((sum, group) => sum + group.total, 0);
  const needed = page * size;
  const collected: SearchHit[] = [];
  for (let index = 0; index < groups.length && collected.length < needed; ) {
    const score = groups[index]!.score;
    const tie: SearchFeatures[] = [];
    while (index < groups.length && groups[index]!.score === score) {
      tie.push(groups[index]!.features);
      index += 1;
    }
    const hot = await pageHotPostIds(db, {
      now,
      page: 1,
      pageSize: needed - collected.length,
      filter: options.filter,
      authorIds: options.authorIds,
      extra: (bind) => searchHotExtra(tie, words, dialect, bind),
    });
    collected.push(...(await loadHits(db, hot.ids, options.query, tie)));
  }

  const ranked = sortSearchResults(collected, options.query, now);
  const start = (page - 1) * size;
  return {
    items: ranked.slice(start, start + size),
    page,
    hasMore: start + size < total,
    total,
    scored: collected.length,
  };
}

async function loadHits(db: PrismaClient, ids: string[], query: string, expected: SearchFeatures[]): Promise<SearchHit[]> {
  if (ids.length === 0) return [];
  const posts = await db.post.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, text: true, createdAt: true },
  });
  const votes = await db.postVote.groupBy({
    by: ["postId"],
    where: { postId: { in: ids } },
    _sum: { value: true },
  });
  const points = new Map(votes.map((row) => [row.postId, row._sum.value ?? 0]));
  const byId = new Map(posts.map((post) => [post.id, post]));
  return ids.map((id) => {
    const post = byId.get(id);
    if (!post) throw new Error(`Search window missed ${id}.`);
    const features = searchFeatures(post, query);
    if (!features || !expected.some((group) => sameSearchFeatures(group, features))) {
      throw new Error(`Search window group did not match ${id}.`);
    }
    return {
      id: post.id,
      title: post.title,
      text: post.text,
      points: points.get(id) ?? 0,
      createdAt: post.createdAt,
    };
  });
}
