export function ListSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-3 px-2 py-3" aria-busy="true" aria-live="polite" aria-label={label}>
      <p className="text-[12px] text-hn-sub">{label}…</p>
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="grid grid-cols-[1.4rem_minmax(0,1fr)] gap-2">
          <div className="mt-1 h-3 rounded-sm bg-[#e5e5dc]" />
          <div>
            <div className="h-3 w-4/5 rounded-sm bg-[#e5e5dc]" />
            <div className="mt-1.5 h-2 w-1/2 rounded-sm bg-[#eeeae2]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="px-2 py-4 text-[13px] text-hn-sub" aria-busy="true" aria-live="polite">
      Loading…
    </div>
  );
}
