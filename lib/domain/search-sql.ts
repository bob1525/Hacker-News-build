import type { SearchFeatures } from "@/lib/domain/search-window";
import type { SqlDialect } from "@/lib/sql-dialect";
import type { FeedFilter } from "@/lib/types";

function titleExpr(dialect: SqlDialect, prefix: string): string {
  return dialect === "postgresql" ? `${prefix}"titleFold"` : `${prefix}titleFold`;
}

function textExpr(dialect: SqlDialect, prefix: string): string {
  return dialect === "postgresql" ? `COALESCE(${prefix}"textFold", '')` : `ifnull(${prefix}textFold, '')`;
}

function contains(expr: string, placeholder: string, dialect: SqlDialect): string {
  return dialect === "postgresql" ? `strpos(${expr}, ${placeholder}) > 0` : `instr(${expr}, ${placeholder}) > 0`;
}

function binder(dialect: SqlDialect, params: Array<string | number>) {
  let next = 1;
  return (value: string | number) => {
    params.push(value);
    if (dialect === "postgresql") return `$${next++}`;
    next += 1;
    return "?";
  };
}

/** Counts of feature groups. The numeric score stays in `searchRelevance`. */
export function searchGroupStatement(
  words: string[],
  dialect: SqlDialect,
  options: { filter?: FeedFilter; authorIds?: string[] } = {},
): { sql: string; params: Array<string | number> } {
  const params: Array<string | number> = [];
  const bind = binder(dialect, params);
  const phrase = words.join(" ");
  const title = titleExpr(dialect, "");
  const text = textExpr(dialect, "");
  const exact = `CASE WHEN ${title} = ${bind(phrase)} THEN 1 ELSE 0 END`;
  const titlePhrase = `CASE WHEN ${contains(title, bind(phrase), dialect)} THEN 1 ELSE 0 END`;
  const textPhrase = `CASE WHEN ${contains(text, bind(phrase), dialect)} THEN 1 ELSE 0 END`;
  const titleCount = words
    .map((word) => `CASE WHEN ${contains(title, bind(word), dialect)} THEN 1 ELSE 0 END`)
    .join(" + ");
  const textCount = words
    .map((word) => `CASE WHEN ${contains(text, bind(word), dialect)} THEN 1 ELSE 0 END`)
    .join(" + ");
  const wordWhere = words
    .map((word) => `(${contains(title, bind(word), dialect)} OR ${contains(text, bind(word), dialect)})`)
    .join(" AND ");
  const filters: string[] = [];
  if (options.filter === "ask") filters.push(dialect === "postgresql" ? '"url" IS NULL' : "url IS NULL");
  if (options.filter === "show") {
    filters.push(dialect === "postgresql" ? `strpos("title", 'Show HN:') = 1` : "instr(title, 'Show HN:') = 1");
  }
  if (options.authorIds && options.authorIds.length > 0) {
    const column = dialect === "postgresql" ? '"authorId"' : "authorId";
    filters.push(`${column} IN (${options.authorIds.map((id) => bind(id)).join(", ")})`);
  }
  const where = [wordWhere, ...filters].join(" AND ");
  const table = dialect === "postgresql" ? '"Post"' : "Post";
  const total = dialect === "postgresql" ? "COUNT(*)::int" : "COUNT(*)";
  const alias = (name: string) => (dialect === "postgresql" ? `"${name}"` : name);
  const sql = `SELECT ${exact} AS ${alias("exactMatch")}, ${titlePhrase} AS ${alias("titlePhrase")}, ${textPhrase} AS ${alias("textPhrase")}, (${titleCount}) AS ${alias("titleCount")}, (${textCount}) AS ${alias("textCount")}, ${total} AS ${alias("total")} FROM ${table} WHERE ${where} GROUP BY 1, 2, 3, 4, 5`;
  return { sql, params };
}

/**
 * Hot-query predicate for one score tie.
 * Placeholders come from `bind` in the order they appear.
 */
export function searchHotExtra(
  groups: SearchFeatures[],
  words: string[],
  dialect: SqlDialect,
  bind: (value: string | number) => string,
): string {
  const phrase = words.join(" ");
  const title = titleExpr(dialect, "p.");
  const text = textExpr(dialect, "p.");
  const wordWhere = words
    .map((word) => `(${contains(title, bind(word), dialect)} OR ${contains(text, bind(word), dialect)})`)
    .join(" AND ");
  const groupsSql = groups
    .map((group) => {
      const exact = `(CASE WHEN ${title} = ${bind(phrase)} THEN 1 ELSE 0 END) = ${bind(group.exact ? 1 : 0)}`;
      const titlePhrase = `(CASE WHEN ${contains(title, bind(phrase), dialect)} THEN 1 ELSE 0 END) = ${bind(group.titlePhrase ? 1 : 0)}`;
      const textPhrase = `(CASE WHEN ${contains(text, bind(phrase), dialect)} THEN 1 ELSE 0 END) = ${bind(group.textPhrase ? 1 : 0)}`;
      const titleCount = `(${words
        .map((word) => `CASE WHEN ${contains(title, bind(word), dialect)} THEN 1 ELSE 0 END`)
        .join(" + ")}) = ${bind(group.titleCount)}`;
      const textCount = `(${words
        .map((word) => `CASE WHEN ${contains(text, bind(word), dialect)} THEN 1 ELSE 0 END`)
        .join(" + ")}) = ${bind(group.textCount)}`;
      return `${exact} AND ${titlePhrase} AND ${textPhrase} AND ${titleCount} AND ${textCount}`;
    })
    .join(" OR ");
  return `${wordWhere} AND (${groupsSql})`;
}
