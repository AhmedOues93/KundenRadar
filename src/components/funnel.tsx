import Link from "next/link";
import { LEAD_STATUS_LABELS } from "@/lib/constants";
import type { LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Reihenfolge des Akquise-Trichters. */
const FUNNEL_STEPS: LeadStatus[] = [
  "NEW",
  "REVIEW",
  "TO_CONTACT",
  "CONTACTED",
  "REPLIED",
  "MEETING",
  "OFFER",
  "WON",
];

/**
 * Akquise-Trichter als schmale Balkenreihe. Zeigt in einer Zeile, wo die
 * Leads stehen – ohne acht Einzelkarten.
 */
export function Funnel({ counts }: { counts: Record<LeadStatus, number> }) {
  const values = FUNNEL_STEPS.map((status) => ({
    status,
    label: LEAD_STATUS_LABELS[status],
    // ANALYZED gehört fachlich in die Prüfen-Stufe.
    value: counts[status] + (status === "REVIEW" ? counts.ANALYZED : 0),
  }));
  const max = Math.max(...values.map((entry) => entry.value), 1);

  return (
    <div className="grid grid-cols-4 gap-px bg-[var(--kr-line)] sm:grid-cols-8">
      {values.map((entry) => (
        <Link
          key={entry.status}
          href={`/leads?status=${entry.status}`}
          className="group bg-white px-2.5 py-2 transition-colors hover:bg-slate-50"
        >
          <p className="truncate text-[11px] text-slate-500">{entry.label}</p>
          <p
            className={cn(
              "mt-0.5 text-[18px] font-semibold leading-none tabnum",
              entry.status === "WON" ? "text-emerald-700" : "text-slate-900",
            )}
          >
            {entry.value}
          </p>
          <span
            aria-hidden
            className="mt-1.5 block h-1 rounded-full bg-slate-100"
            title={`${entry.value} Leads`}
          >
            <span
              className={cn(
                "block h-full rounded-full",
                entry.status === "WON" ? "bg-emerald-500" : "bg-slate-400 group-hover:bg-slate-600",
              )}
              style={{ width: `${Math.round((entry.value / max) * 100)}%` }}
            />
          </span>
        </Link>
      ))}
    </div>
  );
}
