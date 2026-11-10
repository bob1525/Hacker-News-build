"use client";

import { useEffect, useState } from "react";
import { plural } from "@/lib/domain/format";
import { formatRelative } from "@/lib/domain/time";
import { siteLabel } from "@/lib/domain/url";
import type { PostCard } from "@/lib/types";
import { FavoriteButton } from "@/components/favorite-button";
import { RichText } from "@/components/rich-text";
import { VoteButton } from "@/components/vote-button";

export function PostRow({
  post,
  rank,
  viewerId,
  variant = "list",
}: {
  post: PostCard;
  rank?: number;
  viewerId: string | null;
  variant?: "list" | "detail";
}) {
  const [points, setPoints] = useState(post.points);
  const [voted, setVoted] = useState(post.voted);
  const [error, setError] = useState<string | null>(null);
  const domain = post.url ? siteLabel(post.url) : null;
  const discussion = `/item/${post.id}`;
  const owns = viewerId === post.author.id;
  const loginHref = `/login?next=${encodeURIComponent(variant === "detail" ? discussion : discussion)}`;

  useEffect(() => {
    setPoints(post.points);
    setVoted(post.voted);
  }, [post.id, post.points, post.voted]);

  const title = post.url ? (
    <a
      href={post.url}
      className="post-title hover:underline"
      target="_blank"
      rel="noopener noreferrer nofollow"
      data-testid="post-title"
    >
      {post.title}
    </a>
  ) : (
    <a href={discussion} className="post-title hover:underline" data-testid="post-title">
      {post.title}
    </a>
  );

  const body = (
    <div className="min-w-0">
      {variant === "detail" ? (
        <h1 className="text-[14px] font-normal leading-snug">{title}</h1>
      ) : (
        <div className="text-[13.5px] leading-snug">
          {title}
          {domain ? <span className="text-[11px] text-hn-sub"> ({domain})</span> : null}
        </div>
      )}
      {variant === "detail" && domain ? <p className="text-[11px] text-hn-sub">({domain})</p> : null}
      <p className="text-[11px] leading-relaxed text-hn-sub">
        <span data-testid={variant === "detail" ? "post-points" : undefined}>{plural(points, "point")}</span>
        {" by "}
        <a href={`/user/${post.author.username}`} className="hover:underline">
          {post.author.username}
        </a>{" "}
        <a href={discussion} className="hover:underline">
          {formatRelative(new Date(post.createdAt))}
        </a>
        {variant === "list" ? (
          <>
            {" | "}
            <a href={discussion} className="hover:underline">
              {plural(post.commentCount, "comment")}
            </a>
            {viewerId ? (
              <>
                {" | "}
                <FavoriteButton postId={post.id} favorited={post.favorited} />
              </>
            ) : null}
          </>
        ) : null}
      </p>
      {error ? (
        <p role="alert" className="text-[11px] text-hn-danger">
          {error}
        </p>
      ) : null}
      {variant === "detail" && post.text ? (
        <div className="mt-2 max-w-2xl text-[13.5px] leading-relaxed">
          <RichText text={post.text} />
        </div>
      ) : null}
    </div>
  );

  const vote = (
    <VoteButton
      kind="post"
      id={post.id}
      voted={voted}
      points={points}
      canVote={Boolean(viewerId) && !owns}
      owns={owns}
      loginHref={loginHref}
      onChange={(next) => {
        setVoted(next.voted);
        setPoints(next.points);
      }}
      onError={setError}
    />
  );

  if (variant === "detail") {
    return (
      <article data-testid="post-header" className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-1">
        {vote}
        {body}
      </article>
    );
  }

  return (
    <li data-kind={post.url ? "link" : "text"} className="grid grid-cols-[1.5rem_1.25rem_minmax(0,1fr)] gap-x-1 py-[3px]">
      <span className="pt-0.5 text-right text-[13px] tabular-nums text-hn-sub">{rank}</span>
      {vote}
      {body}
    </li>
  );
}
