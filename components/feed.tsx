import { PAGE_SIZE } from "@/lib/config";
import { plural } from "@/lib/domain/format";
import { getCurrentUser } from "@/lib/auth";
import { getFeed } from "@/lib/queries";
import type { FeedFilter, FeedSort } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { PostRow } from "@/components/post-row";

function hrefFor(path: string, page: number, query?: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("p", String(page));
  const value = params.toString();
  return value ? `${path}?${value}` : path;
}

export async function Feed({
  sort,
  filter = "all",
  page,
  path,
  query,
  emptyTitle = "No stories yet.",
  emptyHint = "Be the first to submit one.",
}: {
  sort: FeedSort;
  filter?: FeedFilter;
  page: number;
  path: string;
  query?: string;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const user = await getCurrentUser();
  const result = await getFeed({
    sort,
    filter,
    page,
    query,
    viewerId: user?.id ?? null,
  });

  if (result.total === 0) {
    return (
      <EmptyState
        title={query ? `No posts matched “${query}”.` : emptyTitle}
        hint={query ? "Try a shorter or different keyword from the title or text." : emptyHint}
        action={query ? undefined : { href: "/submit", label: "Submit a story" }}
      />
    );
  }

  if (result.items.length === 0) {
    return (
      <EmptyState title="No more stories on this page." action={{ href: hrefFor(path, 1, query), label: "Back to the first page" }} />
    );
  }

  return (
    <div>
      {query ? (
        <p className="px-2 pt-2 text-[12px] text-hn-sub">
          {plural(result.total, "result")} for “{query}”
        </p>
      ) : null}
      <ol className="px-1 py-1">
        {result.items.map((post, index) => (
          <PostRow
            key={post.id}
            post={post}
            rank={(page - 1) * PAGE_SIZE + index + 1}
            viewerId={user?.id ?? null}
          />
        ))}
      </ol>
      <div className="flex gap-4 px-8 py-2 text-[13px]">
        {page > 1 ? (
          <a href={hrefFor(path, page - 1, query)} className="hover:underline">
            Prev
          </a>
        ) : null}
        {result.hasMore ? (
          <a href={hrefFor(path, page + 1, query)} className="hover:underline">
            More
          </a>
        ) : null}
      </div>
    </div>
  );
}
