/**
 * One case fold for search. SQL stores this text and compares it directly.
 * `lower()` is not used, so SQLite and PostgreSQL follow the same letters as this function.
 *
 * NFC and `toLowerCase` leave `ß` as itself, so `ß` and `SS` used to miss.
 * After lowercasing, `ß` (including capital `ẞ`) expands to `ss`, and final sigma
 * `ς` folds to `σ`, matching the other case of the same letter.
 *
 * `toLowerCase` also leaves the Latin ligatures and the micro sign unchanged.
 * Those expand here, in this function only: ﬁ/ﬂ/ﬀ/ﬃ/ﬄ/ﬅ/ﬆ, µ→μ, and long s ſ→s.
 * Kelvin K and angstrom Å are mapped here as well, so the fold does not depend on
 * an engine that already lowercases those two signs.
 *
 * Full folds that `toLowerCase` leaves unchanged are expanded here too:
 * ΐ/ΰ, ŉ, ǰ, and the Latin letters whose full fold adds a mark (ẖ ẗ ẘ ẙ ẚ).
 * The result is not normalized again, so those expansions stay expanded.
 */
export function foldSearchText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\u212A/g, "k")
    .replace(/\u212B/g, "\u00E5")
    .replace(/\u00B5/g, "\u03BC")
    .replace(/\u017F/g, "s")
    .replace(/\uFB00/g, "ff")
    .replace(/\uFB01/g, "fi")
    .replace(/\uFB02/g, "fl")
    .replace(/\uFB03/g, "ffi")
    .replace(/\uFB04/g, "ffl")
    .replace(/\uFB05/g, "st")
    .replace(/\uFB06/g, "st")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ς/g, "σ")
    .replace(/\u0390/g, "\u03B9\u0308\u0301")
    .replace(/\u03B0/g, "\u03C5\u0308\u0301")
    .replace(/\u0149/g, "\u02BCn")
    .replace(/\u01F0/g, "j\u030C")
    .replace(/\u1E96/g, "h\u0331")
    .replace(/\u1E97/g, "t\u0308")
    .replace(/\u1E98/g, "w\u030A")
    .replace(/\u1E99/g, "y\u030A")
    .replace(/\u1E9A/g, "a\u02BE");
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
