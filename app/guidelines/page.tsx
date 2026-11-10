import type { Metadata } from "next";

export const metadata: Metadata = { title: "Guidelines" };

export default function GuidelinesPage() {
  return (
    <section className="max-w-xl px-2 py-3 text-[13px] leading-relaxed">
      <h1 className="text-[14px]">Guidelines</h1>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>Posts need a title, plus a URL, some text, or both. Use http or https links only.</li>
        <li>Text posts belong on Ask. Titles that start with “Show HN:” belong on Show.</li>
        <li>Vote for work you found useful. You cannot vote on your own posts or comments, and you can take a vote back.</li>
        <li>Comments can be nested up to eight levels. Reply to the point in front of you.</li>
        <li>Karma is the number of upvotes your posts and comments receive. Casting a vote does not change your own karma.</li>
        <li>Be specific. A short correction is more useful than a vague dismissal.</li>
      </ul>
    </section>
  );
}
