import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PostForm } from "@/components/post-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Submit" };

export default async function SubmitPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <EmptyState
        title="Log in to submit a story."
        hint="Accounts are free. Seeded demo users are listed on the login page."
        action={{ href: "/login?next=/submit", label: "Log in" }}
      />
    );
  }

  return (
    <section className="px-2 py-3">
      <h1 className="text-[14px]">Submit</h1>
      <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-hn-sub">
        Leave the URL blank to start a text discussion. You can also include both a link and some context. Titles that
        start with “Show HN:” appear on the Show page.
      </p>
      <PostForm />
    </section>
  );
}
