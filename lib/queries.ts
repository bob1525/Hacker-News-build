import "server-only";
import type { Prisma } from "@prisma/client";
import { PAGE_SIZE } from "@/lib/config";
import { buildCommentTree, type ThreadNode } from "@/lib/domain/comments";
import { sortByHot, sortByNewest } from "@/lib/domain/ranking";
import { sortSearchResults, tokenize } from "@/lib/domain/search";
import { getKarma } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { CommentDTO, FeedFilter, FeedSort, PostCard, ProfileComment, RecentComment } from "@/lib/types";

const WORD_PATTERN = /^[\p{L}\p{N}_]+$/u;

type PostRecord = {
  id: string;
  title: string;
  url: string | null;
  text: string;
  createdAt: Date;
  author: { id: string; username: string };
  points: number;
  commentCount: number;
  voted: boolean;
};

const postInclude = (viewerId: string | null) =>
  ({
    author: { select: { id: true, username: true } },
    _count: { select: { votes: true, comments: true } },
    votes: {
      where: { userId: viewerId ?? "" },
      select: { userId: true },
    },
  }) satisfies Prisma.PostInclude;

type PostRow = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

function toRecord(row: PostRow): PostRecord {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    text: row.text,
    createdAt: row.createdAt,
    author: row.author,
    points: row._count.votes,
    commentCount: row._count.comments,
    voted: row.votes.length > 0,
  };
}

function toCard(record: PostRecord): PostCard {
  return { ...record, createdAt: record.createdAt.toISOString() };
}

export async function searchPostIds(query: string): Promise<string[]> {
  const words = tokenize(query).filter((word) => WORD_PATTERN.test(word));
  if (words.length === 0) return [];

  const clauses = words.map(() => "(instr(lower(title), ?) > 0 OR instr(lower(ifnull(text, '')), ?) > 0)");
  const params = words.flatMap((word) => [word, word]);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM Post WHERE ${clauses.join(" AND ")}`,
    ...params,
  );
  return rows.map((row) => row.id);
}

function feedWhere(filter: FeedFilter, ids: string[] | null): Prisma.PostWhereInput {
  const where: Prisma.PostWhereInput = {};
  if (ids) where.id = { in: ids };
  if (filter === "ask") where.url = null;
  if (filter === "show") where.title = { startsWith: "Show HN:" };
  return where;
}

export async function getFeed(options: {
  sort: FeedSort;
  filter?: FeedFilter;
  page: number;
  query?: string;
  viewerId?: string | null;
}): Promise<{ items: PostCard[]; page: number; hasMore: boolean; total: number }> {
  const page = options.page;
  const filter = options.filter ?? "all";
  const query = options.query?.trim() ?? "";
  const viewerId = options.viewerId ?? null;

  let ids: string[] | null = null;
  if (query) {
    if (tokenize(query).length === 0) return { items: [], page, hasMore: false, total: 0 };
    ids = await searchPostIds(query);
    if (ids.length === 0) return { items: [], page, hasMore: false, total: 0 };
  }

  const rows = await prisma.post.findMany({
    where: feedWhere(filter, ids),
    include: postInclude(viewerId),
  });

  const records = rows.map(toRecord);
  const now = new Date();
  const sorted = query
    ? sortSearchResults(records, query, now)
    : options.sort === "newest"
      ? sortByNewest(records)
      : sortByHot(records, now);

  const start = (page - 1) * PAGE_SIZE;
  const slice = sorted.slice(start, start + PAGE_SIZE);
  return {
    items: slice.map(toCard),
    page,
    hasMore: start + PAGE_SIZE < sorted.length,
    total: sorted.length,
  };
}

type CommentSource = {
  id: string;
  parentId: string | null;
  text: string;
  createdAt: Date;
  author: { id: string; username: string };
  points: number;
  voted: boolean;
};

function serializeComments(nodes: ThreadNode<CommentSource>[]): CommentDTO[] {
  return nodes.map((node) => ({
    id: node.id,
    parentId: node.parentId,
    text: node.text,
    createdAt: node.createdAt.toISOString(),
    author: node.author,
    points: node.points,
    voted: node.voted,
    replies: serializeComments(node.replies),
  }));
}

export async function getPostDetail(id: string, viewerId: string | null) {
  const row = await prisma.post.findUnique({
    where: { id },
    include: postInclude(viewerId),
  });
  if (!row) return null;

  const comments = await prisma.comment.findMany({
    where: { postId: id },
    include: {
      author: { select: { id: true, username: true } },
      _count: { select: { votes: true } },
      votes: {
        where: { userId: viewerId ?? "" },
        select: { userId: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const tree = buildCommentTree(
    comments.map((comment) => ({
      id: comment.id,
      parentId: comment.parentId,
      text: comment.text,
      createdAt: comment.createdAt,
      author: comment.author,
      points: comment._count.votes,
      voted: comment.votes.length > 0,
    })),
  );

  return {
    post: toCard(toRecord(row)),
    comments: serializeComments(tree),
  };
}

export async function getProfile(username: string, viewerId: string | null) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, email: true, about: true, createdAt: true },
  });
  if (!user) return null;

  const [karma, posts, comments] = await Promise.all([
    getKarma(user.id),
    prisma.post.findMany({
      where: { authorId: user.id },
      include: postInclude(viewerId),
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.comment.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        post: { select: { id: true, title: true } },
        _count: { select: { votes: true } },
      },
    }),
  ]);

  const profileComments: ProfileComment[] = comments.map((comment) => ({
    id: comment.id,
    text: comment.text,
    createdAt: comment.createdAt.toISOString(),
    points: comment._count.votes,
    post: comment.post,
  }));

  return {
    user: {
      id: user.id,
      username: user.username,
      about: user.about,
      createdAt: user.createdAt.toISOString(),
      email: viewerId === user.id ? user.email : null,
    },
    karma,
    posts: posts.map((post) => toCard(toRecord(post))),
    comments: profileComments,
  };
}

export async function getRecentComments(): Promise<RecentComment[]> {
  const comments = await prisma.comment.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      author: { select: { username: true } },
      post: { select: { id: true, title: true } },
      _count: { select: { votes: true } },
    },
  });

  return comments.map((comment) => ({
    id: comment.id,
    text: comment.text,
    createdAt: comment.createdAt.toISOString(),
    points: comment._count.votes,
    post: comment.post,
    author: comment.author,
  }));
}
