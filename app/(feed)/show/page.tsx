import type { Metadata } from "next";
import { Feed } from "@/components/feed";
import { parsePage } from "@/lib/domain/format";

export const metadata: Metadata = { title: "Show" };

export default async function ShowPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  return (
    <section>
      <h1 className="sr-only">Show</h1>
      <p className="px-2 pt-2 text-[11px] text-hn-sub">Projects whose titles start with “Show HN:”.</p>
      <Feed
        sort="hot"
        filter="show"
        page={parsePage(p)}
        path="/show"
        emptyTitle="No Show HN posts yet."
        emptyHint="Start a title with “Show HN:” when you submit something you made."
      />
    </section>
  );
}
