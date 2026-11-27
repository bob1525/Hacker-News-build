export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="px-3 py-8 text-[13px]">
      <p className="text-black">{title}</p>
      {hint ? <p className="mt-1 max-w-md text-hn-sub">{hint}</p> : null}
      {action ? (
        <a href={action.href} className="mt-2 inline-block underline">
          {action.label}
        </a>
      ) : null}
    </div>
  );
}
