import { describe, expect, it } from "vitest";
import { COMMENT_EDIT_WINDOW_MS } from "@/lib/config";
import {
  DELETED_COMMENT_TEXT,
  canDeleteComment,
  canEditComment,
  commentDisplayText,
} from "@/lib/domain/comment-moderation";

const createdAt = new Date("2026-03-01T12:00:00.000Z");

function edit(overrides: Partial<Parameters<typeof canEditComment>[0]> = {}) {
  return canEditComment({
    authorId: "demo",
    viewerId: "demo",
    createdAt,
    deletedAt: null,
    now: new Date(createdAt.getTime() + 60_000),
    ...overrides,
  });
}

describe("comment edit and delete", () => {
  it("lets the author edit inside the window", () => {
    expect(edit()).toBe(true);
  });

  it("lets the author edit at the exact end of the window", () => {
    expect(edit({ now: new Date(createdAt.getTime() + COMMENT_EDIT_WINDOW_MS) })).toBe(true);
  });

  it("rejects an edit one millisecond after the window", () => {
    expect(edit({ now: new Date(createdAt.getTime() + COMMENT_EDIT_WINDOW_MS + 1) })).toBe(false);
  });

  it("rejects an edit from someone else", () => {
    expect(edit({ viewerId: "pg" })).toBe(false);
  });

  it("rejects an edit from a logged-out viewer", () => {
    expect(edit({ viewerId: null })).toBe(false);
  });

  it("rejects an edit after the comment is deleted", () => {
    expect(edit({ deletedAt: new Date("2026-03-01T12:05:00.000Z") })).toBe(false);
  });

  it("lets the author delete their comment", () => {
    expect(canDeleteComment({ authorId: "demo", viewerId: "demo", deletedAt: null })).toBe(true);
  });

  it("rejects a delete from someone else or a logged-out viewer", () => {
    expect(canDeleteComment({ authorId: "demo", viewerId: "pg", deletedAt: null })).toBe(false);
    expect(canDeleteComment({ authorId: "demo", viewerId: null, deletedAt: null })).toBe(false);
  });

  it("rejects deleting a comment that is already deleted", () => {
    expect(
      canDeleteComment({ authorId: "demo", viewerId: "demo", deletedAt: new Date("2026-03-01T12:05:00.000Z") }),
    ).toBe(false);
  });

  it("shows 已删除 and hides the original text after a soft delete", () => {
    expect(commentDisplayText("secret note", new Date("2026-03-01T12:05:00.000Z"))).toBe(DELETED_COMMENT_TEXT);
    expect(commentDisplayText("secret note", null)).toBe("secret note");
  });
});
