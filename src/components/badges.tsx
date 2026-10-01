import { Badge } from "@/components/ui";
import {
  ANALYSIS_STATUS_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONE,
  scoreBand,
} from "@/lib/constants";
import type { AnalysisStatus, LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={LEAD_STATUS_TONE[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
}

/**
 * Score als Zahl mit farbigem Balken. In Tabellen zählt die Zahl; das Band
 * steht im Titel, damit die Spalte schmal bleibt.
 */
export function ScoreCell({ score }: { score: number | null | undefined }) {
  const band = scoreBand(score);
  if (!band || score === null || score === undefined) {
    return <span className="text-slate-300">–</span>;
  }

  const fill =
    score >= 80 ? "bg-rose-500" : score >= 60 ? "bg-orange-500" : score >= 30 ? "bg-amber-400" : "bg-slate-300";

  return (
    <span className="inline-flex items-center justify-end gap-1.5" title={band.label}>
      <span className="tabnum font-medium text-slate-900">{score}</span>
      <span aria-hidden className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-100">
        <span className={cn("block h-full rounded-full", fill)} style={{ width: `${score}%` }} />
      </span>
    </span>
  );
}

/** Ausführlichere Variante für Detailseiten. */
export function ScoreBadge({ score }: { score: number | null | undefined }) {
  const band = scoreBand(score);
  if (!band) return <Badge tone="bg-slate-50 text-slate-400 ring-slate-200">Nicht analysiert</Badge>;
  return <Badge tone={band.tone}>{score} · {band.label}</Badge>;
}

export function AnalysisStatusBadge({ status }: { status: AnalysisStatus }) {
  const tones: Record<AnalysisStatus, string> = {
    PENDING: "bg-slate-100 text-slate-600 ring-slate-200",
    SUCCESS: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    FAILED: "bg-rose-50 text-rose-700 ring-rose-200",
    BLOCKED: "bg-amber-50 text-amber-800 ring-amber-200",
  };
  return <Badge tone={tones[status]}>{ANALYSIS_STATUS_LABELS[status]}</Badge>;
}

/**
 * „Agenturhinweis gefunden" – niemals „hat bereits eine Agentur". In Tabellen
 * reicht ein Punkt mit Titel, damit die Zeile schmal bleibt.
 */
export function AgencyBadge({ hasAgency, name }: { hasAgency: boolean; name?: string | null }) {
  if (!hasAgency) return <Badge tone="bg-slate-50 text-slate-500 ring-slate-200">Kein Hinweis</Badge>;
  return (
    <Badge tone="bg-violet-50 text-violet-700 ring-violet-200">
      Agenturhinweis{name ? `: ${name}` : ""}
    </Badge>
  );
}

export function AgencyDot({ hasAgency, name }: { hasAgency: boolean; name?: string | null }) {
  if (!hasAgency) return <span className="text-slate-300">–</span>;
  return (
    <span
      className="inline-flex items-center gap-1 text-[12px] text-violet-700"
      title={name ? `Agenturhinweis gefunden: ${name}` : "Agenturhinweis gefunden"}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-violet-500" />
      <span className="max-w-32 truncate">{name ?? "Hinweis"}</span>
    </span>
  );
}
