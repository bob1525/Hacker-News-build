import type { Page } from "@/lib/domain/pagination";
import { compareByHot } from "@/lib/domain/ranking";
import { searchRelevance, sortSearchResults, tokenize } from "@/lib/domain/search";

export type SearchFeatures = {
  exact: boolean;
  titlePhrase: boolean;
  textPhrase: boolean;
  titleCount: number;
  textCount: number;
};

export type SearchHit = {
  id: string;
  title: string;
  text: string;
  points: number;
  createdAt: Date;
};

/** Feature tuple shared by SQL grouping and `searchRelevance`. Null when the post is not a candidate. */
export function searchFeatures(post: { title: string; text: string }, query: string): SearchFeatures | null {
  const words = tokenize(query);
  if (words.length === 0) return null;
  const phrase = words.join(" ");
  const title = post.title.toLowerCase();
  const text = post.text.toLowerCase();
  if (words.some((word) => !title.includes(word) && !text.includes(word))) return null;
  return {
    exact: title === phrase,
    titlePhrase: title.includes(phrase),
    textPhrase: text.includes(phrase),
    titleCount: words.filter((word) => title.includes(word)).length,
    textCount: words.filter((word) => text.includes(word)).length,
  };
}

export function sameSearchFeatures(left: SearchFeatures, right: SearchFeatures): boolean {
  return (
    left.exact === right.exact &&
    left.titlePhrase === right.titlePhrase &&
    left.textPhrase === right.textPhrase &&
    left.titleCount === right.titleCount &&
    left.textCount === right.textCount
  );
}

function covers(value: string, words: string[]): number {
  return words.filter((word) => value.includes(word)).length;
}

function samplePost(words: string[], features: SearchFeatures): { title: string; text: string } | null {
  const phrase = words.join(" ");
  const combinations = 3 ** words.length;
  for (let mask = 0; mask < combinations; mask += 1) {
    const titleWords: string[] = [];
    const textWords: string[] = [];
    let value = mask;
    for (const word of words) {
      const slot = value % 3;
      value = Math.floor(value / 3);
      if (slot === 0 || slot === 2) titleWords.push(word);
      if (slot === 1 || slot === 2) textWords.push(word);
    }
    let title = titleWords.length === 0 ? "§" : titleWords.join(" § ");
    let text = textWords.length === 0 ? "§" : textWords.join(" § ");
    if (features.exact) title = phrase;
    else if (features.titlePhrase) title = `${phrase} §`;
    if (features.textPhrase) text = phrase;
    if (features.exact !== (title === phrase)) continue;
    if (features.titlePhrase !== title.includes(phrase)) continue;
    if (features.textPhrase !== text.includes(phrase)) continue;
    if (covers(title, words) !== features.titleCount || covers(text, words) !== features.textCount) continue;
    if (words.some((word) => !title.includes(word) && !text.includes(word))) continue;
    return { title, text };
  }
  return null;
}

/** One sample post whose features match, scored only by `searchRelevance`. */
export function relevanceFromFeatures(features: SearchFeatures, query: string): number {
  const words = tokenize(query);
  const sample = samplePost(words, features);
  if (!sample) throw new Error(`No sample post for search features ${JSON.stringify(features)}`);
  const actual = searchFeatures(sample, query);
  if (!actual || !sameSearchFeatures(actual, features)) {
    throw new Error(`Search sample drifted from ${JSON.stringify(features)}`);
  }
  return searchRelevance(sample, query);
}

function featureKey(features: SearchFeatures): string {
  return [features.exact, features.titlePhrase, features.textPhrase, features.titleCount, features.textCount].join(":");
}

function byHotThenId(a: SearchHit, b: SearchHit, now: Date): number {
  const hot = compareByHot(a, b, now);
  if (hot !== 0) return hot;
  return b.id.localeCompare(a.id);
}

/**
 * Score only the rows that can appear on this page.
 * Higher feature groups outrank lower ones, so a filled page does not score the rest.
 * Ties break with the same hot-then-id order as `sortSearchResults`.
 */
export function searchWindow<T extends SearchHit>(
  posts: readonly T[],
  query: string,
  page: number,
  pageSize: number,
  now = new Date(),
): Page<T> & { scored: number } {
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 1;
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const needed = safePage * size;
  if (tokenize(query).length === 0) {
    return { items: [], page: safePage, hasMore: false, total: 0, scored: 0 };
  }

  const groups = new Map<string, { features: SearchFeatures; rows: T[] }>();
  for (const post of posts) {
    const features = searchFeatures(post, query);
    if (!features) continue;
    const key = featureKey(features);
    const group = groups.get(key);
    if (group) group.rows.push(post);
    else groups.set(key, { features, rows: [post] });
  }

  const ordered = [...groups.values()].sort(
    (a, b) => relevanceFromFeatures(b.features, query) - relevanceFromFeatures(a.features, query),
  );
  const total = ordered.reduce((sum, group) => sum + group.rows.length, 0);
  const collected: T[] = [];
  let scored = 0;
  for (let index = 0; index < ordered.length && collected.length < needed; ) {
    const score = relevanceFromFeatures(ordered[index]!.features, query);
    const tie: T[] = [];
    while (index < ordered.length && relevanceFromFeatures(ordered[index]!.features, query) === score) {
      tie.push(...ordered[index]!.rows);
      index += 1;
    }
    tie.sort((a, b) => byHotThenId(a, b, now));
    const take = tie.slice(0, needed - collected.length);
    scored += take.length;
    collected.push(...take);
  }

  const ranked = sortSearchResults(collected, query, now);
  const start = (safePage - 1) * size;
  return {
    items: ranked.slice(start, start + size),
    page: safePage,
    hasMore: start + size < total,
    total,
    scored,
  };
}
