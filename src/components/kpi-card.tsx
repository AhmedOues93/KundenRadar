import Link from "next/link";
import { cn } from "@/lib/utils";

/** Kompakte Kennzahl. Bewusst klein gehalten, damit acht KPIs nebeneinander passen. */
export function KpiCard({
  label,
  value,
  hint,
  href,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  accent?: string;
}) {
  const content = (
    <>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", accent ?? "text-slate-900")}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </>
  );

  const className =
    "rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors";

  if (href) {
    return (
      <Link href={href} className={cn(className, "hover:border-slate-300 hover:bg-slate-50")}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}
