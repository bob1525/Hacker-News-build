/**
 * One case fold for search. SQL stores this text and compares it directly.
 * `lower()` is not used, so SQLite and PostgreSQL follow the same letters as this function.
 *
 * NFC and `toLowerCase` leave `ß` as itself, so `ß` and `SS` used to miss.
 * After lowercasing, `ß` (including capital `ẞ`) expands to `ss`, and final sigma
 * `ς` folds to `σ`, matching the other case of the same letter.
 */
export function foldSearchText(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/ß/g, "ss").replace(/ς/g, "σ");
}

export function withSearchFold<T extends { title?: string; text?: string | null }>(
  data: T,
): T & { titleFold: string; textFold: string } {
  return {
    ...data,
    titleFold: foldSearchText(data.title ?? ""),
    textFold: foldSearchText(data.text ?? ""),
  };
}
