import { DOWNVOTE_MIN_KARMA } from "@/lib/config";

export type VoteValue = 1 | -1;

export function nextVoteValue(existing: VoteValue | null, direction: VoteValue): VoteValue | null {
  if (existing === direction) return null;
  return direction;
}

export function downvoteDecision(input: {
  voterId: string;
  authorId: string;
  karma: number;
  deleted?: boolean;
  kind?: "post" | "comment";
}): { ok: true } | { ok: false; error: string } {
  if (input.deleted) return { ok: false, error: "You can't vote on a deleted comment." };
  if (input.voterId === input.authorId) {
    const target = input.kind === "comment" ? "comment" : "post";
    return { ok: false, error: `You can't vote on your own ${target}.` };
  }
  if (input.karma < DOWNVOTE_MIN_KARMA) {
    return { ok: false, error: `You need at least ${DOWNVOTE_MIN_KARMA} karma to downvote.` };
  }
  return { ok: true };
}
