"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { downvoteComment, downvotePost, voteComment, votePost } from "@/lib/actions/votes";

type VoteState = { voted: boolean; downvoted: boolean; points: number };

export function VoteButton({
  kind,
  id,
  voted,
  downvoted,
  points,
  canVote,
  owns,
  loginHref,
  onChange,
  onError,
  direction = "up",
  variant = "stack",
}: {
  kind: "post" | "comment";
  id: string;
  voted: boolean;
  downvoted: boolean;
  points: number;
  canVote: boolean;
  owns: boolean;
  loginHref: string;
  onChange: (next: VoteState) => void;
  onError: (message: string | null) => void;
  direction?: "up" | "down";
  variant?: "stack" | "inline";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const active = direction === "up" ? voted : downvoted;
  const glyph = direction === "up" ? "▲" : "▼";
  const className =
    variant === "inline"
      ? `cursor-pointer px-0.5 text-[11px] leading-none disabled:opacity-50 ${active ? "text-hn-orange" : "text-[#9a9a9a] hover:text-hn-orange"}`
      : `inline-flex h-7 w-5 cursor-pointer items-start justify-center pt-0.5 text-[11px] leading-none disabled:opacity-50 ${active ? "text-hn-orange" : "text-[#9a9a9a] hover:text-hn-orange"}`;

  if (!canVote) {
    const label = owns ? "You can't vote on your own submission" : "Log in to vote";
    if (owns) {
      return (
        <span className={className.replace("cursor-pointer", "")} title={label} aria-hidden="true">
          {glyph}
        </span>
      );
    }
    return (
      <a href={loginHref} className={className} aria-label={label} title={label}>
        {glyph}
      </a>
    );
  }

  async function toggle() {
    const previous = { voted, downvoted, points };
    onError(null);
    onChange(optimisticVote({ voted, downvoted, points }, direction));
    setPending(true);
    const result =
      direction === "down"
        ? kind === "post"
          ? await downvotePost(id)
          : await downvoteComment(id)
        : kind === "post"
          ? await votePost(id)
          : await voteComment(id);
    setPending(false);
    if (!result.ok) {
      onChange(previous);
      onError(result.error);
      return;
    }
    onChange(result.data);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={active}
      aria-label={direction === "down" ? (active ? "Remove downvote" : "Downvote") : active ? "Unvote" : "Upvote"}
      className={className}
    >
      {glyph}
    </button>
  );
}

function optimisticVote(current: VoteState, direction: "up" | "down"): VoteState {
  if (direction === "up") {
    if (current.voted) return { voted: false, downvoted: false, points: current.points - 1 };
    return { voted: true, downvoted: false, points: current.points + (current.downvoted ? 2 : 1) };
  }
  if (current.downvoted) return { voted: false, downvoted: false, points: current.points + 1 };
  return { voted: false, downvoted: true, points: current.points - (current.voted ? 2 : 1) };
}
