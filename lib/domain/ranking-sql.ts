import type { PrismaClient } from "@prisma/client";
import { sqlDialect, type SqlDialect } from "@/lib/sql-dialect";
import type { FeedFilter } from "@/lib/types";

/** Fifth-root Newton steps. 20 drifts once x is far past 100000; 40 stays near 1e-12 through 1e12. */
export const SQLITE_HOT_NEWTON_STEPS = 40;

export type HotPage = {
  ids: string[];
  page: number;
  hasMore: boolean;
  total: number;
};

/** Shared Newton script. `source` must expose id, createdAt, points, and x. */
function sqliteNewtonCte(source: string): string {
  return `
    pow AS (
      SELECT
        id,
        createdAt,
        points,
        0 AS step,
        x * x AS y,
        x * x * x * x * x * x * x * x * x AS a
      FROM ${source}
      UNION ALL
      SELECT
        id,
        createdAt,
        points,
        step + 1,
        (4.0 * y + a / ((y * y) * (y * y))) / 5.0,
        a
      FROM pow
      WHERE step < ${SQLITE_HOT_NEWTON_STEPS}
    )
  `;
}

/**
 * The same Newton iteration pageHotPostIds uses, evaluated for one age term.
 * Tests compare this with Math.pow(x, 1.8). It is not a second ranking formula.
 */
export async function sqliteHotExponent(db: PrismaClient, agePlusTwo: number): Promise<number> {
  const rows = await db.$queryRawUnsafe<Array<{ y: number }>>(
    `
    WITH base AS (
      SELECT 'x' AS id, 0 AS createdAt, 1 AS points, ? AS x
    ),
    ${sqliteNewtonCte("base")}
    SELECT y AS y FROM pow WHERE step = ${SQLITE_HOT_NEWTON_STEPS}
    `,
    agePlusTwo,
  );
  return Number(rows[0]?.y);
}

/**
 * Orders synthetic rows with the same Newton expression as pageHotPostIds.
 * Ages past what a DateTime column can store are compared here, not in SQL
 * as a second relevance or hot formula.
 */
export async function sqliteHotOrder(
  db: PrismaClient,
  rows: Array<{ id: string; points: number; agePlusTwo: number }>,
): Promise<string[]> {
  if (rows.length === 0) return [];
  const values = rows.map(() => "(?, 0, ?, ?)").join(", ");
  const params = rows.flatMap((row) => [row.id, row.points, row.agePlusTwo]);
  const ranked = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `
    WITH base(id, createdAt, points, x) AS (
      VALUES ${values}
    ),
    ${sqliteNewtonCte("base")}
    SELECT id
    FROM pow
    WHERE step = ${SQLITE_HOT_NEWTON_STEPS}
    ORDER BY ((points - 1) * 1.0 / y) DESC, createdAt DESC, id DESC
    `,
    ...params,
  );
  return ranked.map((row) => row.id);
}

/**
 * Hot order in SQL.
 * Prisma's SQLite build has no power(), so (ageHours + 2) ^ 1.8 is the fifth
 * root of x^9, refined with SQLITE_HOT_NEWTON_STEPS Newton steps. Forty steps
 * keep the relative error near 1e-12 for x up to 1e12. Twenty steps were
 * already ~1e-15 through x = 100000, then drifted (about 5e-9 at 1e8 and
 * about 6e-3 at 1e9). Same points and the same createdAt then sort by id
 * descending. PostgreSQL uses power() instead of this iteration.
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
    extra?: (bind: (value: string | number) => string) => string;
  },
): Promise<HotPage> {
  const size = Number.isFinite(options.pageSize) && options.pageSize > 0 ? Math.floor(options.pageSize) : 1;
  const page = Number.isInteger(options.page) && options.page > 0 ? options.page : 1;
  const offset = (page - 1) * size;
  if ((options.authorIds && options.authorIds.length === 0) || (options.ids && options.ids.length === 0)) {
    return { ids: [], page, hasMore: false, total: 0 };
  }
  if (sqlDialect() === "postgresql") return pageHotPostIdsPostgres(db, options, size, page, offset);
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
      SELECT p.id AS id, p.createdAt AS createdAt, MAX(COALESCE(SUM(v.value), 0), 0) AS points
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
    ${sqliteNewtonCte("base")}
    SELECT id
    FROM pow
    WHERE step = ${SQLITE_HOT_NEWTON_STEPS}
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

/** Newest order in SQL: createdAt descending, then id descending. */
export async function pageNewestPostIds(
  db: PrismaClient,
  options: {
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
  const dialect = sqlDialect();
  const where = hotWhere(options, dialect);
  const quoted = dialect === "postgresql";
  const table = quoted ? '"Post"' : "Post";
  const idCol = quoted ? 'p."id"' : "p.id";
  const createdCol = quoted ? 'p."createdAt"' : "p.createdAt";
  const limit = quoted ? `$${where.nextIndex}` : "?";
  const offsetSql = quoted ? `$${where.nextIndex + 1}` : "?";
  const countExpr = quoted ? "COUNT(*)::int" : "COUNT(*)";
  const totalRows = await db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
    `SELECT ${countExpr} AS total FROM ${table} p WHERE ${where.sql}`,
    ...where.params,
  );
  const total = Number(totalRows[0]?.total ?? 0);
  if (offset >= total) return { ids: [], page, hasMore: false, total };
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT ${idCol} AS id FROM ${table} p WHERE ${where.sql} ORDER BY ${createdCol} DESC, ${idCol} DESC LIMIT ${limit} OFFSET ${offsetSql}`,
    ...where.params,
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

/**
 * PostgreSQL stores DateTime as timestamp(3), has power(), and quotes identifiers.
 * The score is the same (points - 1) / (ageHours + 2) ^ 1.8 expression as the
 * memory sort. SQLite keeps the Newton script above because its Prisma build
 * has no power().
 */
async function pageHotPostIdsPostgres(
  db: PrismaClient,
  options: {
    now: Date;
    page: number;
    pageSize: number;
    filter?: FeedFilter;
    authorIds?: string[];
    ids?: string[];
    extra?: (bind: (value: string | number) => string) => string;
  },
  size: number,
  page: number,
  offset: number,
): Promise<HotPage> {
  const where = hotWhere(options, "postgresql");
  const nowIndex = where.nextIndex;
  const limitIndex = nowIndex + 1;
  const offsetIndex = nowIndex + 2;
  const totalRows = await db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
    `SELECT COUNT(*)::int AS total FROM "Post" p WHERE ${where.sql}`,
    ...where.params,
  );
  const total = Number(totalRows[0]?.total ?? 0);
  if (offset >= total) return { ids: [], page, hasMore: false, total };

  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `
    WITH grouped AS (
      SELECT p."id" AS id, p."createdAt" AS "createdAt", GREATEST(COALESCE(SUM(v."value"), 0), 0)::int AS points
      FROM "Post" p
      LEFT JOIN "PostVote" v ON v."postId" = p."id"
      WHERE ${where.sql}
      GROUP BY p."id", p."createdAt"
    )
    SELECT id
    FROM grouped
    ORDER BY (
      (points - 1)::float / power(
        GREATEST(
          EXTRACT(EPOCH FROM ($${nowIndex}::timestamptz - ("createdAt" AT TIME ZONE 'UTC'))),
          0
        ) / 3600.0 + 2.0,
        1.8
      )
    ) DESC, "createdAt" DESC, id DESC
    LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `,
    ...where.params,
    options.now,
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

function hotWhere(
  options: {
    filter?: FeedFilter;
    authorIds?: string[];
    ids?: string[];
    extra?: (bind: (value: string | number) => string) => string;
  },
  dialect: SqlDialect = "sqlite",
): {
  sql: string;
  params: Array<string | number>;
  nextIndex: number;
} {
  const clauses: string[] = [];
  const params: Array<string | number> = [];
  let nextIndex = 1;
  const mark = () => (dialect === "postgresql" ? `$${nextIndex++}` : (nextIndex += 1, "?"));
  const column = (name: string) => (dialect === "postgresql" ? `"${name}"` : name);
  if (options.filter === "ask") clauses.push(`p.${column("url")} IS NULL`);
  if (options.filter === "show") {
    clauses.push(
      dialect === "postgresql" ? `strpos(p."title", 'Show HN:') = 1` : "instr(p.title, 'Show HN:') = 1",
    );
  }
  if (options.authorIds && options.authorIds.length > 0) {
    clauses.push(`p.${column("authorId")} IN (${options.authorIds.map(() => mark()).join(", ")})`);
    params.push(...options.authorIds);
  }
  if (options.ids && options.ids.length > 0) {
    clauses.push(`p.${column("id")} IN (${options.ids.map(() => mark()).join(", ")})`);
    params.push(...options.ids);
  }
  if (options.extra) {
    clauses.push(`(${options.extra((value) => {
      params.push(value);
      return mark();
    })})`);
  }
  return { sql: clauses.length > 0 ? clauses.join(" AND ") : "1 = 1", params, nextIndex };
}
