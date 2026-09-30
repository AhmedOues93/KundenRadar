import { Badge } from "@/components/ui";
import {
  ANALYSIS_STATUS_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONE,
  scoreBand,
} from "@/lib/constants";
import type { AnalysisStatus, LeadStatus } from "@/lib/types";

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={LEAD_STATUS_TONE[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
}

/**
 * Zeigt den Score mit Bandbezeichnung. Bewusst neutral formuliert: der Wert
 * beschreibt das Analysepotenzial, keine Abschlusswahrscheinlichkeit.
 */
export function ScoreBadge({ score }: { score: number | null | undefined }) {
  const band = scoreBand(score);
  if (!band) {
    return <Badge tone="bg-slate-50 text-slate-400 ring-slate-200">Nicht analysiert</Badge>;
  }
  return (
    <Badge tone={band.tone} title={band.label}>
      {score} · {band.label}
    </Badge>
  );
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

/** „Agenturhinweis gefunden" – niemals „hat bereits eine Agentur". */
export function AgencyBadge({
  hasAgency,
  name,
}: {
  hasAgency: boolean;
  name?: string | null;
}) {
  if (!hasAgency) {
    return <Badge tone="bg-slate-50 text-slate-500 ring-slate-200">Kein Agenturhinweis</Badge>;
  }
  return (
    <Badge tone="bg-violet-50 text-violet-700 ring-violet-200">
      Agenturhinweis gefunden{name ? `: ${name}` : ""}
    </Badge>
  );
}
