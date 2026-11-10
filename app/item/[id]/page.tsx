import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommentForm } from "@/components/comment-form";
import { CommentThread } from "@/components/comment-thread";
import { EmptyState } from "@/components/empty-state";
import { FavoriteButton } from "@/components/favorite-button";
import { PostRow } from "@/components/post-row";
import { plural } from "@/lib/domain/format";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPostDetail } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id }, select: { title: true } });
  return { title: post?.title ?? "Story" };
}

export default async function ItemPage({ params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  const detail = await getPostDetail(id, user?.id ?? null);
  if (!detail) notFound();

  return (
    <article className="px-2 py-2">
      <PostRow post={detail.post} viewerId={user?.id ?? null} variant="detail" />
      {user ? (
        <p className="pl-6 pt-1">
          <FavoriteButton postId={detail.post.id} favorited={detail.post.favorited} />
        </p>
      ) : null}
      <section className="mt-4 max-w-3xl pl-5">
        <h2 className="text-[12px] text-hn-sub">{plural(detail.post.commentCount, "comment")}</h2>
        {user ? (
          <CommentForm postId={detail.post.id} />
        ) : (
          <p className="mt-2 text-[13px]">
            <a className="underline" href={`/login?next=${encodeURIComponent(`/item/${id}`)}`}>
              Log in
            </a>{" "}
            to join the thread.
          </p>
        )}
        {detail.comments.length === 0 ? (
          <EmptyState title="No comments yet." hint="Be the first to add one." />
        ) : (
          <CommentThread comments={detail.comments} postId={detail.post.id} viewerId={user?.id ?? null} />
        )}
      </section>
    </article>
  );
}
