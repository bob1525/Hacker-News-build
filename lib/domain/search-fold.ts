/**
 * One case fold for search. SQL stores this text and compares it directly.
 * `lower()` is not used, so SQLite and PostgreSQL follow the same letters as this function.
 */
export function foldSearchText(value: string): string {
  return value.normalize("NFC").toLowerCase();
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
