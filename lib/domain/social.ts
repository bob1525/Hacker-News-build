export type FollowEdge = {
  followerId: string;
  followingId: string;
};

export function decideFavorite(already: boolean): { favorited: boolean } {
  return { favorited: !already };
}

export function decideFollow(
  followerId: string,
  followingId: string,
  already: boolean,
): { ok: true; following: boolean } | { ok: false; error: string } {
  if (!followerId || followerId === followingId) {
    return { ok: false, error: "You can't follow yourself." };
  }
  return { ok: true, following: !already };
}

export function countFollowers(edges: readonly FollowEdge[], userId: string): number {
  return edges.filter((edge) => edge.followingId === userId && edge.followerId !== edge.followingId).length;
}

export function countFollowing(edges: readonly FollowEdge[], userId: string): number {
  return edges.filter((edge) => edge.followerId === userId && edge.followerId !== edge.followingId).length;
}

/** Keep authors that the viewer follows, preserving the input order and dropping duplicates. */
export function followedAuthorIds(authorIds: readonly string[], followedIds: readonly string[]): string[] {
  const followed = new Set(followedIds);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const authorId of authorIds) {
    if (!followed.has(authorId) || seen.has(authorId)) continue;
    seen.add(authorId);
    kept.push(authorId);
  }
  return kept;
}
