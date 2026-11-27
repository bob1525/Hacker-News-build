import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { RichText } from "@/components/rich-text";
import { plural } from "@/lib/domain/format";
import { formatRelative } from "@/lib/domain/time";
import { getRecentComments } from "@/lib/queries";

export const metadata: Metadata = { title: "Comments" };

export default async function CommentsPage() {
  const comments = await getRecentComments();

  return (
    <section className="px-2 py-2">
      <h1 className="sr-only">New comments</h1>
      <p className="pb-1 text-[11px] text-hn-sub">Latest comments across the site.</p>
      {comments.length === 0 ? (
        <EmptyState title="No comments yet." hint="Open a story and start a thread." action={{ href: "/", label: "Browse stories" }} />
      ) : (
        <ol>
          {comments.map((comment) => (
            <li key={comment.id} className="border-b border-hn-line py-2">
              <p className="text-[11px] text-hn-sub">
                <a href={`/user/${comment.author.username}`} className="hover:underline">
                  {comment.author.username}
                </a>{" "}
                {formatRelative(new Date(comment.createdAt))}
                {" · "}
                {plural(comment.points, "point")}
                {" | "}
                <a href={`/item/${comment.post.id}#c-${comment.id}`} className="hover:underline">
                  on: {comment.post.title}
                </a>
              </p>
              <div className="max-w-2xl pt-1 text-[13.5px] leading-relaxed">
                <RichText text={comment.text} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
