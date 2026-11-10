import "server-only";
import type { Prisma } from "@prisma/client";
import { PAGE_SIZE } from "@/lib/config";
import { canDeleteComment, canEditComment, commentDisplayText } from "@/lib/domain/comment-moderation";
import { buildCommentTree, type ThreadNode } from "@/lib/domain/comments";
import { paginate } from "@/lib/domain/pagination";
import { pageHotPostIds } from "@/lib/domain/ranking-sql";
import { sortByHot, sortByNewest } from "@/lib/domain/ranking";
import { rankingBackend } from "@/lib/ranking-backend";
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
  favorited: boolean;
};

const postInclude = (viewerId: string | null) =>
  ({
    author: { select: { id: true, username: true } },
    _count: { select: { votes: true, comments: true } },
    votes: {
      where: { userId: viewerId ?? "" },
      select: { userId: true },
    },
    favorites: {
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
    favorited: row.favorites.length > 0,
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

function feedWhere(filter: FeedFilter, ids: string[] | null, authorIds?: string[]): Prisma.PostWhereInput {
  const where: Prisma.PostWhereInput = {};
  if (ids) where.id = { in: ids };
  if (authorIds) where.authorId = { in: authorIds };
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
  authorIds?: string[];
}): Promise<{ items: PostCard[]; page: number; hasMore: boolean; total: number }> {
  const page = options.page;
  const filter = options.filter ?? "all";
  const query = options.query?.trim() ?? "";
  const viewerId = options.viewerId ?? null;
  if (options.authorIds && options.authorIds.length === 0) {
    return { items: [], page, hasMore: false, total: 0 };
  }

  let ids: string[] | null = null;
  if (query) {
    if (tokenize(query).length === 0) return { items: [], page, hasMore: false, total: 0 };
    ids = await searchPostIds(query);
    if (ids.length === 0) return { items: [], page, hasMore: false, total: 0 };
  }

  const now = new Date();
  if (!query && options.sort !== "newest" && rankingBackend() === "sql") {
    const hot = await pageHotPostIds(prisma, {
      now,
      page,
      pageSize: PAGE_SIZE,
      filter,
      authorIds: options.authorIds,
    });
    if (hot.ids.length === 0) {
      return { items: [], page: hot.page, hasMore: hot.hasMore, total: hot.total };
    }
    const hotRows = await prisma.post.findMany({
      where: { id: { in: hot.ids } },
      include: postInclude(viewerId),
    });
    const byId = new Map(hotRows.map((row) => [row.id, row]));
    const items = hot.ids.map((id) => {
      const row = byId.get(id);
      if (!row) throw new Error(`Ranked post ${id} was not loaded.`);
      return toCard(toRecord(row));
    });
    return {
      items,
      page: hot.page,
      hasMore: hot.hasMore,
      total: hot.total,
    };
  }

  const rows = await prisma.post.findMany({
    where: feedWhere(filter, ids, options.authorIds),
    include: postInclude(viewerId),
  });

  const records = rows.map(toRecord);
  const sorted = query
    ? sortSearchResults(records, query, now)
    : options.sort === "newest"
      ? sortByNewest(records)
      : sortByHot(records, now);

  const paged = paginate(sorted, page, PAGE_SIZE);
  return {
    items: paged.items.map(toCard),
    page: paged.page,
    hasMore: paged.hasMore,
    total: paged.total,
  };
}

type CommentSource = {
  id: string;
  parentId: string | null;
  text: string;
  createdAt: Date;
  editedAt: string | null;
  deleted: boolean;
  editable: boolean;
  deletable: boolean;
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
    editedAt: node.editedAt,
    deleted: node.deleted,
    editable: node.editable,
    deletable: node.deletable,
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

  const now = new Date();
  const tree = buildCommentTree(
    comments.map((comment) => ({
      id: comment.id,
      parentId: comment.parentId,
      text: commentDisplayText(comment.text, comment.deletedAt),
      createdAt: comment.createdAt,
      editedAt: comment.editedAt ? comment.editedAt.toISOString() : null,
      deleted: comment.deletedAt != null,
      editable: canEditComment({
        authorId: comment.authorId,
        viewerId,
        createdAt: comment.createdAt,
        deletedAt: comment.deletedAt,
        now,
      }),
      deletable: canDeleteComment({
        authorId: comment.authorId,
        viewerId,
        deletedAt: comment.deletedAt,
      }),
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

  const [karma, posts, comments, followerCount, followingCount, viewerFollow, favorites] = await Promise.all([
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
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    viewerId
      ? prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
          select: { followerId: true },
        })
      : Promise.resolve(null),
    prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { post: { include: postInclude(viewerId) } },
    }),
  ]);

  const profileComments: ProfileComment[] = comments.map((comment) => ({
    id: comment.id,
    text: commentDisplayText(comment.text, comment.deletedAt),
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
    followerCount,
    followingCount,
    viewerFollows: Boolean(viewerFollow),
    posts: posts.map((post) => toCard(toRecord(post))),
    comments: profileComments,
    favorites: favorites.map((favorite) => toCard(toRecord(favorite.post))),
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
    text: commentDisplayText(comment.text, comment.deletedAt),
    createdAt: comment.createdAt.toISOString(),
    points: comment._count.votes,
    post: comment.post,
    author: comment.author,
  }));
}
