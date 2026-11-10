import type { Metadata } from "next";
import { Feed } from "@/components/feed";
import { parsePage } from "@/lib/domain/format";

export const metadata: Metadata = { title: "Ask" };

export default async function AskPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  return (
    <section>
      <h1 className="sr-only">Ask</h1>
      <p className="px-2 pt-2 text-[11px] text-hn-sub">Text posts, ranked like the front page.</p>
      <Feed
        sort="hot"
        filter="ask"
        page={parsePage(p)}
        path="/ask"
        emptyTitle="No text posts yet."
        emptyHint="Leave the URL blank when you submit to start a discussion."
      />
    </section>
  );
}
