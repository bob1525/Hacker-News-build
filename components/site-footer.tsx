import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-hn-line">
      <div className="mx-auto flex w-full max-w-[980px] flex-col items-center gap-1 px-2 py-4 text-center text-[11px] text-hn-sub">
        <p>
          <Link className="hover:underline" href="/guidelines">
            Guidelines
          </Link>
          <span> · </span>
          <Link className="hover:underline" href="/newest">
            New
          </Link>
          <span> · </span>
          <Link className="hover:underline" href="/search">
            Search
          </Link>
          <span> · </span>
          <Link className="hover:underline" href="/submit">
            Submit
          </Link>
        </p>
        <p>A compact Hacker News-style community for stories and discussion.</p>
      </div>
    </footer>
  );
}
