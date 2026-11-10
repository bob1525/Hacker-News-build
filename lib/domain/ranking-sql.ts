import type { PrismaClient } from "@prisma/client";
import type { FeedFilter } from "@/lib/types";

const NEWTON_STEPS = 20;

export type HotPage = {
  ids: string[];
  page: number;
  hasMore: boolean;
  total: number;
};

/**
 * Hot order in SQL.
 * Prisma's SQLite build has no power(), so (ageHours + 2) ^ 1.8 is the fifth
 * root of x^9, refined with 20 Newton steps. That stays within about 1e-15
 * relative error for x up to 100000 (roughly 11 years). Same points and the
 * same createdAt then sort by id descending.
 */
export async function pageHotPostIds(
  db: PrismaClient,
  options: {
    now: Date;
    page: number;
    pageSize: number;
    filter?: FeedFilter;
    authorIds?: string[];
    ids?: string[];
  },
): Promise<HotPage> {
  const size = Number.isFinite(options.pageSize) && options.pageSize > 0 ? Math.floor(options.pageSize) : 1;
  const page = Number.isInteger(options.page) && options.page > 0 ? options.page : 1;
  const offset = (page - 1) * size;
  if ((options.authorIds && options.authorIds.length === 0) || (options.ids && options.ids.length === 0)) {
    return { ids: [], page, hasMore: false, total: 0 };
  }
  const where = hotWhere(options);
  const nowMs = options.now.getTime();

  const totalRows = await db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
    `SELECT COUNT(*) AS total FROM Post p WHERE ${where.sql}`,
    ...where.params,
  );
  const total = Number(totalRows[0]?.total ?? 0);
  if (offset >= total) {
    return { ids: [], page, hasMore: false, total };
  }

  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `
    WITH grouped AS (
      SELECT p.id AS id, p.createdAt AS createdAt, COUNT(v.userId) AS points
      FROM Post p
      LEFT JOIN PostVote v ON v.postId = p.id
      WHERE ${where.sql}
      GROUP BY p.id
    ),
    base AS (
      SELECT
        id,
        createdAt,
        points,
        (CASE WHEN (? - createdAt) > 0 THEN (? - createdAt) ELSE 0 END) / 3600000.0 + 2.0 AS x
      FROM grouped
    ),
    pow AS (
      SELECT
        id,
        createdAt,
        points,
        0 AS step,
        x * x AS y,
        x * x * x * x * x * x * x * x * x AS a
      FROM base
      UNION ALL
      SELECT
        id,
        createdAt,
        points,
        step + 1,
        (4.0 * y + a / ((y * y) * (y * y))) / 5.0,
        a
      FROM pow
      WHERE step < ${NEWTON_STEPS}
    )
    SELECT id
    FROM pow
    WHERE step = ${NEWTON_STEPS}
    ORDER BY ((points - 1) * 1.0 / y) DESC, createdAt DESC, id DESC
    LIMIT ? OFFSET ?
    `,
    ...where.params,
    nowMs,
    nowMs,
    size,
    offset,
  );

  return {
    ids: rows.map((row) => row.id),
    page,
    hasMore: offset + size < total,
    total,
  };
}

function hotWhere(options: { filter?: FeedFilter; authorIds?: string[]; ids?: string[] }): {
  sql: string;
  params: Array<string>;
} {
  const clauses: string[] = [];
  const params: string[] = [];
  if (options.filter === "ask") clauses.push("p.url IS NULL");
  if (options.filter === "show") clauses.push("instr(p.title, 'Show HN:') = 1");
  if (options.authorIds && options.authorIds.length > 0) {
    clauses.push(`p.authorId IN (${options.authorIds.map(() => "?").join(", ")})`);
    params.push(...options.authorIds);
  }
  if (options.ids && options.ids.length > 0) {
    clauses.push(`p.id IN (${options.ids.map(() => "?").join(", ")})`);
    params.push(...options.ids);
  }
  return { sql: clauses.length > 0 ? clauses.join(" AND ") : "1 = 1", params };
}
