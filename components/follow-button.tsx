"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toggleFollow } from "@/lib/actions/social";

export function FollowButton({ username, following }: { username: string; following: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(following);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOn(following);
  }, [username, following]);

  async function toggle() {
    setError(null);
    setPending(true);
    const result = await toggleFollow(username);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOn(result.data.following);
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        className="cursor-pointer text-[13px] underline disabled:opacity-60"
      >
        {on ? "unfollow" : "follow"}
      </button>
      {error ? (
        <span role="alert" className="text-[12px] text-hn-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
