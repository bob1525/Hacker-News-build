"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { mergeGuestCollapsesAction } from "@/lib/actions/comment-collapse";
import { COLLAPSED_COMMENTS_KEY, guestCollapseRemainder, parseCollapsedIds } from "@/lib/domain/collapsed-comments";

/** After login, copy this browser's guest collapses into the account, then refresh. */
export function GuestCollapseSync({ viewerId }: { viewerId: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!viewerId) return;
    const ids = parseCollapsedIds(localStorage.getItem(COLLAPSED_COMMENTS_KEY));
    if (ids.length === 0) return;
    let cancelled = false;
    mergeGuestCollapsesAction(ids).then((result) => {
      if (cancelled || !result.ok) return;
      const remain = guestCollapseRemainder(ids, result.data);
      if (remain.length === 0) localStorage.removeItem(COLLAPSED_COMMENTS_KEY);
      else localStorage.setItem(COLLAPSED_COMMENTS_KEY, JSON.stringify(remain));
      if (result.data.merged.length > 0) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [viewerId, router]);

  return null;
}
