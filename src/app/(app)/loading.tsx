/** Platzhalter während Server-Komponenten laden – gleiche Dichte wie die Seiten. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Inhalte werden geladen</span>
      <div className="flex items-center justify-between">
        <div className="h-5 w-48 rounded bg-slate-200" />
        <div className="h-8 w-40 rounded bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[var(--kr-line)] bg-[var(--kr-line)] sm:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="bg-white px-3 py-2">
            <div className="h-2.5 w-16 rounded bg-slate-200" />
            <div className="mt-1.5 h-4 w-10 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="rounded-md border border-[var(--kr-line)] bg-white">
        <div className="border-b border-[var(--kr-line)] px-3 py-2">
          <div className="h-3 w-28 rounded bg-slate-200" />
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-[var(--kr-line)] px-3 py-2 last:border-b-0">
            <div className="h-3 w-56 rounded bg-slate-200" />
            <div className="h-3 w-24 rounded bg-slate-100" />
            <div className="ml-auto h-3 w-16 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
