import type { Metadata } from "next";
import { Feed } from "@/components/feed";
import { parsePage } from "@/lib/domain/format";

export const metadata: Metadata = { title: { absolute: "Hacker News" } };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  return (
    <section>
      <h1 className="sr-only">Top stories</h1>
      <Feed sort="hot" page={parsePage(p)} path="/" />
    </section>
  );
}
