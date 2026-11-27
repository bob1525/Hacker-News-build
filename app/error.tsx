"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="px-3 py-8 text-[13px]">
      <p>Something went wrong while loading this page.</p>
      <p className="mt-1 text-hn-sub">The data is still there. Try the page again.</p>
      <button type="button" onClick={reset} className="mt-3 cursor-pointer underline">
        Try again
      </button>
    </div>
  );
}
