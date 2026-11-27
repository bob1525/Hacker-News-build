import type { PrismaClient } from "@prisma/client";
import { foldSearchText } from "@/lib/domain/search-fold";

/** How many stored folds differ from the current `foldSearchText`. */
export async function countStaleSearchFolds(db: PrismaClient): Promise<number> {
  const posts = await db.post.findMany({
    select: { title: true, text: true, titleFold: true, textFold: true },
  });
  let stale = 0;
  for (const post of posts) {
    if (post.titleFold !== foldSearchText(post.title) || post.textFold !== foldSearchText(post.text)) stale += 1;
  }
  return stale;
}

/** Rewrite stored folds with `foldSearchText` so older rows match new queries. Running it again updates nothing. */
export async function backfillSearchFolds(db: PrismaClient): Promise<number> {
  const posts = await db.post.findMany({
    select: { id: true, title: true, text: true, titleFold: true, textFold: true },
  });
  let updated = 0;
  for (const post of posts) {
    const titleFold = foldSearchText(post.title);
    const textFold = foldSearchText(post.text);
    if (post.titleFold === titleFold && post.textFold === textFold) continue;
    await db.post.update({ where: { id: post.id }, data: { titleFold, textFold } });
    updated += 1;
  }
  return updated;
}
