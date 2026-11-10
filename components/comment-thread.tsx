"use client";

import { useEffect, useState } from "react";
import { plural } from "@/lib/domain/format";
import { formatRelative } from "@/lib/domain/time";
import type { CommentDTO } from "@/lib/types";
import { CommentForm } from "@/components/comment-form";
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
}: {
  node: CommentDTO;
  postId: string;
  viewerId: string | null;
  depth: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [points, setPoints] = useState(node.points);
  const [voted, setVoted] = useState(node.voted);
  const [error, setError] = useState<string | null>(null);
  const owns = viewerId === node.author.id;
  const descendants = descendantCount(node);
  const indent = depth === 0 ? 0 : Math.min(depth * 12, 72);

  useEffect(() => {
    setPoints(node.points);
    setVoted(node.voted);
  }, [node.id, node.points, node.voted]);

  return (
    <article id={`c-${node.id}`} data-testid="comment" className="pt-2" style={{ marginLeft: indent }}>
      <div className={depth > 0 ? "border-l border-[#e4e4dc] pl-2" : undefined}>
        <div className="flex flex-wrap items-center gap-x-1 text-[11px] text-hn-sub">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand comment" : "Collapse comment"}
            className="cursor-pointer hover:text-black"
          >
            {collapsed ? "[+]" : "[–]"}
          </button>
          <a href={`/user/${node.author.username}`} className="hover:underline">
            {node.author.username}
          </a>
          <span>{formatRelative(new Date(node.createdAt))}</span>
          <span aria-hidden="true">|</span>
          <span>{plural(points, "point")}</span>
          <VoteButton
            kind="comment"
            id={node.id}
            voted={voted}
            points={points}
            canVote={Boolean(viewerId) && !owns}
            owns={owns}
            loginHref={`/login?next=${encodeURIComponent(`/item/${postId}`)}`}
            variant="inline"
            onChange={(next) => {
              setVoted(next.voted);
              setPoints(next.points);
            }}
            onError={setError}
          />
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
            {viewerId ? (
              <button
                type="button"
                onClick={() => setReplyOpen((value) => !value)}
                className="cursor-pointer text-[11px] text-hn-sub underline"
              >
                reply
              </button>
            ) : (
              <a href={`/login?next=${encodeURIComponent(`/item/${postId}`)}`} className="text-[11px] text-hn-sub underline">
                reply
              </a>
            )}
            {replyOpen ? <CommentForm postId={postId} parentId={node.id} autoFocus /> : null}
            {node.replies.map((reply) => (
              <CommentItem key={reply.id} node={reply} postId={postId} viewerId={viewerId} depth={depth + 1} />
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
}: {
  comments: CommentDTO[];
  postId: string;
  viewerId: string | null;
}) {
  return (
    <div className="mt-2">
      {comments.map((comment) => (
        <CommentItem key={comment.id} node={comment} postId={postId} viewerId={viewerId} depth={0} />
      ))}
    </div>
  );
}
