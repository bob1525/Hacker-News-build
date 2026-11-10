"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { voteComment, votePost } from "@/lib/actions/votes";

type VoteState = { voted: boolean; points: number };

export function VoteButton({
  kind,
  id,
  voted,
  points,
  canVote,
  owns,
  loginHref,
  onChange,
  onError,
  variant = "stack",
}: {
  kind: "post" | "comment";
  id: string;
  voted: boolean;
  points: number;
  canVote: boolean;
  owns: boolean;
  loginHref: string;
  onChange: (next: VoteState) => void;
  onError: (message: string | null) => void;
  variant?: "stack" | "inline";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const className =
    variant === "inline"
      ? `cursor-pointer px-0.5 text-[11px] leading-none disabled:opacity-50 ${voted ? "text-hn-orange" : "text-[#9a9a9a] hover:text-hn-orange"}`
      : `inline-flex h-7 w-5 cursor-pointer items-start justify-center pt-0.5 text-[11px] leading-none disabled:opacity-50 ${voted ? "text-hn-orange" : "text-[#9a9a9a] hover:text-hn-orange"}`;

  if (!canVote) {
    const label = owns ? "You can't vote on your own submission" : "Log in to vote";
    if (owns) {
      return (
        <span className={className.replace("cursor-pointer", "")} title={label} aria-hidden="true">
          ▲
        </span>
      );
    }
    return (
      <a href={loginHref} className={className} aria-label={label} title={label}>
        ▲
      </a>
    );
  }

  async function toggle() {
    const previous = { voted, points };
    onError(null);
    onChange({ voted: !voted, points: points + (voted ? -1 : 1) });
    setPending(true);
    const result = kind === "post" ? await votePost(id) : await voteComment(id);
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
      aria-pressed={voted}
      aria-label={voted ? "Unvote" : "Upvote"}
      className={className}
    >
      ▲
    </button>
  );
}
