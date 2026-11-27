export type KarmaEvent = {
  authorId: string;
  voterId: string;
};

/** Karma is upvotes received on posts and comments. Votes you cast, and votes on your own posts, do not count. */
export function karmaFromEvents(events: KarmaEvent[], userId: string): number {
  return events.reduce((sum, event) => {
    if (event.authorId === userId && event.voterId !== userId) return sum + 1;
    return sum;
  }, 0);
}

export function computeKarma(postUpvotes: number, commentUpvotes: number): number {
  const posts = Number.isFinite(postUpvotes) ? Math.max(0, postUpvotes) : 0;
  const comments = Number.isFinite(commentUpvotes) ? Math.max(0, commentUpvotes) : 0;
  return posts + comments;
}
