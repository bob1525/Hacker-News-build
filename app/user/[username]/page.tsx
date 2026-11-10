import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PostRow } from "@/components/post-row";
import { RichText } from "@/components/rich-text";
import { plural } from "@/lib/domain/format";
import { formatDateUTC, formatRelative } from "@/lib/domain/time";
import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/queries";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: username };
}

export default async function UserPage({ params }: Params) {
  const { username } = await params;
  const viewer = await getCurrentUser();
  const profile = await getProfile(username.toLowerCase(), viewer?.id ?? null);
  if (!profile) notFound();

  return (
    <section className="px-2 py-3">
      <h1 className="sr-only">{profile.user.username}</h1>
      <dl className="grid max-w-2xl grid-cols-[5.5rem_minmax(0,1fr)] gap-y-1 text-[13px]">
        <dt className="text-hn-sub">user</dt>
        <dd>{profile.user.username}</dd>
        <dt className="text-hn-sub">created</dt>
        <dd>{formatDateUTC(profile.user.createdAt)}</dd>
        <dt className="text-hn-sub">karma</dt>
        <dd data-testid="karma">{profile.karma}</dd>
        <dt className="text-hn-sub">about</dt>
        <dd>{profile.user.about ? <RichText text={profile.user.about} /> : <span className="text-hn-sub">No bio yet.</span>}</dd>
        {profile.user.email ? (
          <>
            <dt className="text-hn-sub">email</dt>
            <dd>{profile.user.email}</dd>
          </>
        ) : null}
      </dl>

      <h2 className="mb-1 mt-5 text-[13px]">posts</h2>
      {profile.posts.length === 0 ? (
        <EmptyState title="No posts yet." hint="Stories this account submits will be listed here." />
      ) : (
        <ol>
          {profile.posts.map((post, index) => (
            <PostRow key={post.id} post={post} rank={index + 1} viewerId={viewer?.id ?? null} />
          ))}
        </ol>
      )}

      <h2 className="mb-1 mt-4 text-[13px]">comments</h2>
      {profile.comments.length === 0 ? (
        <EmptyState title="No comments yet." hint="Replies this account writes will be listed here." />
      ) : (
        <ol>
          {profile.comments.map((comment) => (
            <li key={comment.id} className="border-b border-hn-line py-2">
              <p className="text-[11px] text-hn-sub">
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
