import { COMMENT_EDIT_WINDOW_MS } from "@/lib/config";

export const DELETED_COMMENT_TEXT = "已删除";

export function canEditComment(input: {
  authorId: string;
  viewerId: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  now?: Date;
}): boolean {
  if (!input.viewerId || input.viewerId !== input.authorId) return false;
  if (input.deletedAt) return false;
  const now = input.now ?? new Date();
  return now.getTime() - input.createdAt.getTime() <= COMMENT_EDIT_WINDOW_MS;
}

export function canDeleteComment(input: {
  authorId: string;
  viewerId: string | null;
  deletedAt: Date | null;
}): boolean {
  if (!input.viewerId || input.viewerId !== input.authorId) return false;
  return input.deletedAt == null;
}

export function commentDisplayText(text: string, deletedAt: Date | null): string {
  return deletedAt ? DELETED_COMMENT_TEXT : text;
}
