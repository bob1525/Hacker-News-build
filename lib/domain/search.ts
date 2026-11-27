import { paginate, type Page } from "@/lib/domain/pagination";
import { compareByHot, type Rankable } from "@/lib/domain/ranking";
import { foldSearchText } from "@/lib/domain/search-fold";

const WORD_PATTERN = /^[\p{L}\p{N}_]+$/u;

export function tokenize(query: string): string[] {
  return foldSearchText(query)
    .split(/[^\p{L}\p{N}_]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && WORD_PATTERN.test(word))
    .slice(0, 8);
}

export function searchRelevance(post: { title: string; text: string }, query: string): number {
  const words = tokenize(query);
  if (words.length === 0) return 0;

  const title = foldSearchText(post.title);
  const text = foldSearchText(post.text);
  const phrase = words.join(" ");
  let score = 0;

  if (title === phrase) score += 120;
  if (title.includes(phrase)) score += 40;
  if (text.includes(phrase)) score += 12;

  for (const word of words) {
    if (title.includes(word)) score += 10;
    if (text.includes(word)) score += 3;
  }

  return score;
}

export function sortSearchResults<T extends Rankable & { title: string; text: string }>(
  items: T[],
  query: string,
  now = new Date(),
): T[] {
  return [...items].sort((a, b) => {
    const relevance = searchRelevance(b, query) - searchRelevance(a, query);
    if (relevance !== 0) return relevance;
    const hot = compareByHot(a, b, now);
    if (hot !== 0) return hot;
    return searchId(b).localeCompare(searchId(a));
  });
}

/** Score the SQL candidate set with `searchRelevance`, then slice one stable page. */
export function pageSearchResults<T extends Rankable & { title: string; text: string }>(
  items: readonly T[],
  query: string,
  page: number,
  pageSize: number,
  now = new Date(),
): Page<T> {
  return paginate(sortSearchResults([...items], query, now), page, pageSize);
}

function searchId(item: Rankable & { title: string; text: string }): string {
  return "id" in item && typeof item.id === "string" ? item.id : "";
}
