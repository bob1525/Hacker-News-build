import type { Metadata } from "next";
import { Feed } from "@/components/feed";
import { EmptyState } from "@/components/empty-state";
import { parsePage } from "@/lib/domain/format";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Following" };

export default async function FollowingPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    return (
      <EmptyState
        title="Log in to see stories from people you follow."
        action={{ href: "/login?next=/following", label: "Log in" }}
      />
    );
  }

  const follows = await prisma.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  });

  return (
    <section>
      <h1 className="sr-only">Following</h1>
      <p className="px-2 pt-2 text-[11px] text-hn-sub">Stories from people you follow, ranked like the front page.</p>
      {follows.length === 0 ? (
        <EmptyState title="You are not following anyone yet." hint="Open a profile and follow someone." />
      ) : (
        <Feed
          sort="hot"
          page={parsePage(p)}
          path="/following"
          authorIds={follows.map((follow) => follow.followingId)}
          emptyTitle="No stories from people you follow."
          emptyHint="The accounts you follow have not submitted anything yet."
        />
      )}
    </section>
  );
}
