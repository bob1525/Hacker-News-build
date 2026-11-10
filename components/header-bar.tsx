"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { logout } from "@/lib/actions/auth";

const LINKS = [
  { href: "/newest", label: "new" },
  { href: "/ask", label: "ask" },
  { href: "/show", label: "show" },
  { href: "/comments", label: "comments" },
  { href: "/submit", label: "submit" },
];

export function HeaderBar({ user }: { user: { username: string; karma: number } | null }) {
  const params = useSearchParams();
  const path = usePathname();
  const query = params.get("q") ?? "";

  return (
    <header className="sticky top-0 z-30 bg-hn-orange text-[13px] text-black">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-1.5 px-2 py-1.5 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href="/" className="inline-flex items-center gap-1.5 font-bold">
            <span
              aria-hidden="true"
              className="inline-flex h-[18px] w-[18px] items-center justify-center border border-white text-[12px] font-bold leading-none text-white"
            >
              Y
            </span>
            Hacker News
          </Link>
          <nav aria-label="Primary" className="flex flex-wrap items-center gap-x-1.5">
            {LINKS.map((link) => (
              <span key={link.href} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="text-black/40">|</span>
                <NavLink href={link.href} label={link.label} path={path} />
              </span>
            ))}
          </nav>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:justify-end">
          <form action="/search" className="min-w-0 flex-1 sm:max-w-[200px]">
            <label htmlFor="header-search" className="sr-only">
              Search
            </label>
            <input
              id="header-search"
              key={query}
              name="q"
              defaultValue={query}
              placeholder="Search"
              autoComplete="off"
              className="w-full border border-[#ff8f45] bg-white px-1.5 py-0.5 text-[13px] outline-none"
            />
          </form>
          <div className="shrink-0">
            {user ? (
              <span className="inline-flex items-center gap-1.5">
                <Link href="/following" className={path === "/following" ? "underline" : "hover:underline"}>
                  following
                </Link>
                <Link href={`/user/${user.username}`} data-testid="current-user" className="hover:underline">
                  {user.username}
                </Link>
                <span className="text-black/70">({user.karma})</span>
                <form action={logout}>
                  <button type="submit" className="cursor-pointer hover:underline">
                    logout
                  </button>
                </form>
              </span>
            ) : (
              <Link href="/login" className="hover:underline">
                login
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, label, path }: { href: string; label: string; path: string }) {
  const active = path === href;
  return (
    <Link href={href} className={active ? "underline" : "hover:underline"} aria-current={active ? "page" : undefined}>
      {label}
    </Link>
  );
}
