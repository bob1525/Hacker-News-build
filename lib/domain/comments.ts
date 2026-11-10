export type ThreadNode<T> = T & { replies: ThreadNode<T>[] };

/**
 * Siblings: more points first. Equal points stay oldest-first, then id.
 * Missing points count as zero, so unvoted threads keep the previous order.
 */
function byPointsThenOldest<T extends { createdAt: Date; id: string; points?: number }>(a: T, b: T): number {
  const pointsDelta = (b.points ?? 0) - (a.points ?? 0);
  if (pointsDelta !== 0) return pointsDelta;
  const delta = a.createdAt.getTime() - b.createdAt.getTime();
  if (delta !== 0) return delta;
  return a.id.localeCompare(b.id);
}

/**
 * Build a comment forest ranked by points, then time.
 * Missing parents become roots. Cycles are broken so every comment appears once.
 */
export function buildCommentTree<T extends { id: string; parentId: string | null; createdAt: Date }>(
  comments: T[],
): ThreadNode<T>[] {
  const unique: T[] = [];
  const seenIds = new Set<string>();
  for (const comment of comments) {
    if (seenIds.has(comment.id)) continue;
    seenIds.add(comment.id);
    unique.push(comment);
  }

  const nodes = new Map<string, ThreadNode<T>>();
  for (const comment of unique) {
    nodes.set(comment.id, { ...comment, replies: [] });
  }

  const childIds = new Set<string>();
  for (const comment of unique) {
    const parentId = comment.parentId;
    if (!parentId || parentId === comment.id || !nodes.has(parentId)) continue;
    nodes.get(parentId)?.replies.push(nodes.get(comment.id)!);
    childIds.add(comment.id);
  }

  const visited = new Set<string>();

  const sanitize = (node: ThreadNode<T>, stack: Set<string>) => {
    visited.add(node.id);
    stack.add(node.id);
    const children = [...node.replies]
      .sort(byPointsThenOldest)
      .filter((child) => !stack.has(child.id) && !visited.has(child.id));
    node.replies = children;
    for (const child of children) sanitize(child, stack);
    stack.delete(node.id);
  };

  const forest: ThreadNode<T>[] = [];
  const roots = unique
    .filter((comment) => !childIds.has(comment.id))
    .map((comment) => nodes.get(comment.id)!)
    .sort(byPointsThenOldest);

  for (const root of roots) {
    if (visited.has(root.id)) continue;
    forest.push(root);
    sanitize(root, new Set());
  }

  const stranded = [...nodes.values()].filter((node) => !visited.has(node.id)).sort(byPointsThenOldest);
  for (const node of stranded) {
    if (visited.has(node.id)) continue;
    forest.push(node);
    sanitize(node, new Set());
  }

  return forest;
}

export function maxThreadDepth<T>(nodes: ThreadNode<T>[]): number {
  let max = 0;
  const walk = (list: ThreadNode<T>[], depth: number) => {
    for (const node of list) {
      max = Math.max(max, depth);
      walk(node.replies, depth + 1);
    }
  };
  walk(nodes, 1);
  return max;
}

export function countThreadNodes<T>(nodes: ThreadNode<T>[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countThreadNodes(node.replies), 0);
}
