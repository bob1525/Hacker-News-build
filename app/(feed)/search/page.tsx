import type { Metadata } from "next";
import { Feed } from "@/components/feed";
import { EmptyState } from "@/components/empty-state";
import { buttonClass, inputClass } from "@/components/styles";
import { parsePage } from "@/lib/domain/format";
import { tokenize } from "@/lib/domain/search";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  const { q = "", p } = await searchParams;
  const query = q.trim();
  const tokens = tokenize(query);

  return (
    <section>
      <h1 className="sr-only">Search</h1>
      <form action="/search" className="flex max-w-xl items-center gap-2 px-2 py-3">
        <label htmlFor="search-q" className="sr-only">
          Search posts
        </label>
        <input
          id="search-q"
          name="q"
          defaultValue={query}
          placeholder="Title or text"
          autoComplete="off"
          className={inputClass}
        />
        <button type="submit" className={buttonClass}>
          search
        </button>
      </form>
      {!query ? (
        <EmptyState
          title="Search stories"
          hint="Try a word from a title or the text, such as sqlite or ferrocene. Matching ignores letter case."
        />
      ) : null}
      {query && tokens.length === 0 ? (
        <EmptyState title="Type at least 2 characters." hint="Very short fragments are ignored so the results stay useful." />
      ) : null}
      {tokens.length > 0 ? (
        <Feed
          sort="hot"
          page={parsePage(p)}
          path="/search"
          query={query}
          emptyTitle="No posts matched."
          emptyHint="Try another keyword."
        />
      ) : null}
    </section>
  );
}
