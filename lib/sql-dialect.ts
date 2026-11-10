export type SqlDialect = "sqlite" | "postgresql";

export function sqlDialect(env?: { DATABASE_URL?: string }): SqlDialect {
  const url = env?.DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) return "postgresql";
  return "sqlite";
}

/** Search predicate shared by SQLite and PostgreSQL. Placeholders follow the dialect. */
export function searchPostSql(wordCount: number, dialect: SqlDialect = sqlDialect()): string {
  if (!Number.isInteger(wordCount) || wordCount < 1) {
    throw new Error("searchPostSql requires at least one word");
  }
  const clauses = Array.from({ length: wordCount }, (_, index) => {
    const title = placeholder(dialect, index * 2 + 1);
    const body = placeholder(dialect, index * 2 + 2);
    if (dialect === "postgresql") {
      return `(strpos(lower("title"), ${title}) > 0 OR strpos(lower(COALESCE("text", '')), ${body}) > 0)`;
    }
    return `(instr(lower(title), ${title}) > 0 OR instr(lower(ifnull(text, '')), ${body}) > 0)`;
  });
  const table = dialect === "postgresql" ? '"Post"' : "Post";
  const id = dialect === "postgresql" ? '"id"' : "id";
  return `SELECT ${id} FROM ${table} WHERE ${clauses.join(" AND ")}`;
}

function placeholder(dialect: SqlDialect, index: number): string {
  return dialect === "postgresql" ? `$${index}` : "?";
}
