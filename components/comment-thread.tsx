"use client";

import { useEffect, useState } from "react";
import { setCommentCollapsed } from "@/lib/actions/comment-collapse";
import { deleteComment } from "@/lib/actions/comments";
import { COLLAPSED_COMMENTS_KEY, parseCollapsedIds, toggleCollapsedId } from "@/lib/domain/collapsed-comments";
import { canReplyAtDepth, commentDepthMark, commentIndentStepPx, commentThreadGutter } from "@/lib/domain/comments";
import { plural } from "@/lib/domain/format";
import { formatRelative } from "@/lib/domain/time";
import type { CommentDTO } from "@/lib/types";
import { CommentForm } from "@/components/comment-form";
import { EditCommentForm } from "@/components/edit-comment-form";
import { RichText } from "@/components/rich-text";
import { VoteButton } from "@/components/vote-button";

function descendantCount(node: CommentDTO): number {
  return node.replies.reduce((sum, reply) => sum + 1 + descendantCount(reply), 0);
}

function CommentItem({
  node,
  postId,
  viewerId,
  depth,
  collapsedIds,
  onToggle,
}: {
  node: CommentDTO;
  postId: string;
  viewerId: string | null;
  depth: number;
  collapsedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [points, setPoints] = useState(node.points);
  const [voted, setVoted] = useState(node.voted);
  const [downvoted, setDownvoted] = useState(node.downvoted);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const collapsed = collapsedIds.includes(node.id);
  const owns = viewerId === node.author.id;
  const descendants = descendantCount(node);
  const indent = commentIndentStepPx(depth);
  const gutter = commentThreadGutter(depth);
  const depthMark = commentDepthMark(depth);
  const canReply = canReplyAtDepth(depth + 1);

  useEffect(() => {
    setPoints(node.points);
    setVoted(node.voted);
    setDownvoted(node.downvoted);
  }, [node.id, node.points, node.voted, node.downvoted]);

  async function remove() {
    setError(null);
    setPendingDelete(true);
    const result = await deleteComment(node.id);
    setPendingDelete(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.location.reload();
  }

  return (
    <article
      id={`c-${node.id}`}
      data-testid="comment"
      data-deleted={node.deleted ? "true" : "false"}
      className="pt-2"
      style={{ marginLeft: indent }}
    >
      <div
        data-comment-gutter={gutter ? "true" : "false"}
        className={gutter ? "border-l border-[#e4e4dc] pl-2" : undefined}
      >
        <div className="flex flex-wrap items-center gap-x-1 text-[11px] text-hn-sub">
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand comment" : "Collapse comment"}
            className="cursor-pointer hover:text-black"
          >
            {collapsed ? "[+]" : "[–]"}
          </button>
          {depthMark ? (
            <span
              data-testid="comment-depth-mark"
              title={`Nested ${depthMark} levels`}
              className="rounded-sm border border-hn-orange px-1 font-mono text-[10px] leading-tight text-hn-orange"
            >
              {depthMark}
            </span>
          ) : null}
          <a href={`/user/${node.author.username}`} className="hover:underline">
            {node.author.username}
          </a>
          <span>{formatRelative(new Date(node.createdAt))}</span>
          {node.editedAt && !node.deleted ? <span>edited</span> : null}
          <span aria-hidden="true">|</span>
          <span data-testid="comment-points">{plural(points, "point")}</span>
          {node.deleted ? null : (
            <>
              <VoteButton
                kind="comment"
                id={node.id}
                voted={voted}
                downvoted={downvoted}
                points={points}
                canVote={Boolean(viewerId) && !owns}
                owns={owns}
                loginHref={`/login?next=${encodeURIComponent(`/item/${postId}`)}`}
                variant="inline"
                onChange={(next) => {
                  setVoted(next.voted);
                  setDownvoted(next.downvoted);
                  setPoints(next.points);
                }}
                onError={setError}
              />
              <VoteButton
                kind="comment"
                id={node.id}
                direction="down"
                voted={voted}
                downvoted={downvoted}
                points={points}
                canVote={Boolean(viewerId) && !owns}
                owns={owns}
                loginHref={`/login?next=${encodeURIComponent(`/item/${postId}`)}`}
                variant="inline"
                onChange={(next) => {
                  setVoted(next.voted);
                  setDownvoted(next.downvoted);
                  setPoints(next.points);
                }}
                onError={setError}
              />
            </>
          )}
          {collapsed && descendants > 0 ? <span>{descendants} more</span> : null}
        </div>
        {error ? (
          <p role="alert" className="text-[11px] text-hn-danger">
            {error}
          </p>
        ) : null}
        {collapsed ? null : (
          <>
            <div className="max-w-2xl py-1 text-[13.5px] leading-relaxed">
              <RichText text={node.text} />
            </div>
            {editing && node.editable ? <EditCommentForm commentId={node.id} initialText={node.text} /> : null}
            <div className="flex gap-2 text-[11px] text-hn-sub">
              {canReply && viewerId && !node.deleted ? (
                <button
                  type="button"
                  onClick={() => setReplyOpen((value) => !value)}
                  className="cursor-pointer underline"
                >
                  reply
                </button>
              ) : canReply && !node.deleted ? (
                <a href={`/login?next=${encodeURIComponent(`/item/${postId}`)}`} className="underline">
                  reply
                </a>
              ) : null}
              {node.editable ? (
                <button type="button" onClick={() => setEditing((value) => !value)} className="cursor-pointer underline">
                  edit
                </button>
              ) : null}
              {node.deletable ? (
                <button type="button" onClick={remove} disabled={pendingDelete} className="cursor-pointer underline">
                  {pendingDelete ? "deleting…" : "delete"}
                </button>
              ) : null}
            </div>
            {replyOpen ? <CommentForm postId={postId} parentId={node.id} autoFocus /> : null}
            {node.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                node={reply}
                postId={postId}
                viewerId={viewerId}
                depth={depth + 1}
                collapsedIds={collapsedIds}
                onToggle={onToggle}
              />
            ))}
          </>
        )}
      </div>
    </article>
  );
}

export function CommentThread({
  comments,
  postId,
  viewerId,
  initialCollapsedIds = [],
}: {
  comments: CommentDTO[];
  postId: string;
  viewerId: string | null;
  initialCollapsedIds?: string[];
}) {
  const [collapsedIds, setCollapsedIds] = useState<string[]>(() => (viewerId ? initialCollapsedIds : []));

  useEffect(() => {
    if (viewerId) return;
    setCollapsedIds(parseCollapsedIds(localStorage.getItem(COLLAPSED_COMMENTS_KEY)));
  }, [viewerId]);

  async function onToggle(id: string) {
    const previous = collapsedIds;
    const next = toggleCollapsedId(previous, id);
    setCollapsedIds(next);
    if (!viewerId) {
      localStorage.setItem(COLLAPSED_COMMENTS_KEY, JSON.stringify(next));
      return;
    }
    const result = await setCommentCollapsed(id, next.includes(id));
    if (!result.ok) setCollapsedIds(previous);
  }

  return (
    <div className="mt-2">
      <CommentForest comments={comments} postId={postId} viewerId={viewerId} collapsedIds={collapsedIds} onToggle={onToggle} />
    </div>
  );
}

function CommentForest({
  comments,
  postId,
  viewerId,
  collapsedIds,
  onToggle,
  depth = 0,
}: {
  comments: CommentDTO[];
  postId: string;
  viewerId: string | null;
  collapsedIds: string[];
  onToggle: (id: string) => void;
  depth?: number;
}) {
  return (
    <>
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          node={comment}
          postId={postId}
          viewerId={viewerId}
          depth={depth}
          collapsedIds={collapsedIds}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}
