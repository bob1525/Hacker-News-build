import type { Metadata } from "next";
import { Feed } from "@/components/feed";
import { parsePage } from "@/lib/domain/format";

export const metadata: Metadata = { title: "New" };

export default async function NewestPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  return (
    <section>
      <h1 className="sr-only">Newest stories</h1>
      <p className="px-2 pt-2 text-[11px] text-hn-sub">Newest first, ignoring score.</p>
      <Feed
        sort="newest"
        page={parsePage(p)}
        path="/newest"
        emptyTitle="No stories yet."
        emptyHint="New submissions show up here in chronological order."
      />
    </section>
  );
}
