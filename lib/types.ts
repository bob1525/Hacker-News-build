export type FormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type PostCard = {
  id: string;
  title: string;
  url: string | null;
  text: string;
  createdAt: string;
  author: { id: string; username: string };
  points: number;
  commentCount: number;
  voted: boolean;
};

export type CommentDTO = {
  id: string;
  parentId: string | null;
  text: string;
  createdAt: string;
  author: { id: string; username: string };
  points: number;
  voted: boolean;
  replies: CommentDTO[];
};

export type FeedSort = "hot" | "newest";
export type FeedFilter = "all" | "ask" | "show";

export type ProfileComment = {
  id: string;
  text: string;
  createdAt: string;
  points: number;
  post: { id: string; title: string };
};

export type RecentComment = ProfileComment & {
  author: { username: string };
};
