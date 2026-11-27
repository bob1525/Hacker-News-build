"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toggleFavorite } from "@/lib/actions/social";

export function FavoriteButton({ postId, favorited }: { postId: string; favorited: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(favorited);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOn(favorited);
  }, [postId, favorited]);

  async function toggle() {
    setError(null);
    setPending(true);
    const result = await toggleFavorite(postId);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOn(result.data.favorited);
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        className="cursor-pointer text-[11px] text-hn-sub underline disabled:opacity-60"
      >
        {on ? "unfavorite" : "favorite"}
      </button>
      {error ? (
        <span role="alert" className="text-[11px] text-hn-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
