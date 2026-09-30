"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { analyzeLeadsBatch } from "@/lib/actions/discovery";
import { BATCH_DEFAULTS } from "@/lib/analysis/batch-limits";
import { AgencyBadge, AnalysisStatusBadge, ScoreBadge } from "@/components/badges";
import { Alert, Badge, Button, EmptyState } from "@/components/ui";
import { FINDING_SEVERITY_TONE } from "@/lib/constants";
import type { QualificationRow } from "@/lib/queries";
import type { ActionState } from "@/lib/actions/shared";
import { displayUrl, formatDateTime } from "@/lib/utils";

const INITIAL: ActionState = { ok: true };

/**
 * Qualifizierungsliste. Standardsortierung kommt aus der Datenbank (höchstes
 * Analysepotenzial zuerst). Auswahl und Stapel-Analyse laufen über eine
 * Server Action; die Analyse selbst ist die aus Phase 1.
 */
export function QualificationList({ rows }: { rows: QualificationRow[] }) {
  const [state, action] = useActionState(analyzeLeadsBatch, INITIAL);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const analyzable = useMemo(
    () => rows.filter((row) => Boolean(row.lead.website_url)),
    [rows],
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Wählt die noch nicht analysierten Leads mit Website, begrenzt auf einen Stapel. */
  function selectUnanalyzed() {
    const candidates = analyzable
      .filter((row) => !row.analysis)
      .slice(0, BATCH_DEFAULTS.maxItems)
      .map((row) => row.lead.id);
    setSelected(new Set(candidates));
  }

  function selectVisible() {
    setSelected(
      new Set(analyzable.slice(0, BATCH_DEFAULTS.maxItems).map((row) => row.lead.id)),
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Keine Leads für diese Filter"
        description="Passe die Filter an oder starte eine neue Lead-Suche."
      />
    );
  }

  return (
    <div className="space-y-3">
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <form action={action} className="space-y-3">
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="leadId" value={id} />
        ))}

        <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          <span className="text-xs font-medium text-slate-600">{selected.size} ausgewählt</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button type="button" variant="secondary" size="sm" onClick={selectUnanalyzed}>
              Nicht analysierte wählen
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={selectVisible}>
              Sichtbare wählen
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0}
            >
              Auswahl leeren
            </Button>
            <AnalyzeButton count={selected.size} />
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Die Stapel-Analyse läuft mit {BATCH_DEFAULTS.concurrency} gleichzeitigen Abfragen und
          maximal {BATCH_DEFAULTS.maxItems} Leads pro Durchlauf. Ein Fehler bei einem Lead stoppt
          den Stapel nicht.
        </p>

        <ul className="space-y-2">
          {rows.map(({ lead, analysis }) => {
            const checked = selected.has(lead.id);
            const topFindings = (analysis?.findings ?? [])
              .filter((finding) => finding.points > 0)
              .sort((a, b) => b.points - a.points)
              .slice(0, 3);

            return (
              <li
                key={lead.id}
                className={
                  checked
                    ? "rounded-lg border border-slate-400 bg-slate-50 px-3 py-2.5"
                    : "rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                }
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(lead.id)}
                    disabled={!lead.website_url}
                    aria-label={`${lead.company_name} für die Analyse auswählen`}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 disabled:opacity-40"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="text-sm font-medium text-slate-900 hover:underline"
                      >
                        {lead.company_name}
                      </Link>
                      <ScoreBadge score={lead.potential_score} />
                      {analysis ? <AnalysisStatusBadge status={analysis.status} /> : null}
                      <AgencyBadge
                        hasAgency={lead.has_agency}
                        name={lead.detected_agency_name}
                      />
                    </div>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {[lead.industry, [lead.postal_code, lead.city].filter(Boolean).join(" ")]
                        .filter(Boolean)
                        .join(" · ") || "Keine Angaben"}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs">
                      {lead.website_url ? (
                        <a
                          href={lead.website_url}
                          target="_blank"
                          rel="noreferrer noopener nofollow"
                          className="text-slate-700 hover:underline"
                        >
                          {displayUrl(lead.website_url, 34)}
                        </a>
                      ) : (
                        <span className="text-amber-700">Keine Website hinterlegt</span>
                      )}
                      {analysis ? (
                        <span className="text-slate-400">
                          Analyse: {formatDateTime(analysis.created_at)}
                        </span>
                      ) : (
                        <span className="text-slate-400">Noch nicht analysiert</span>
                      )}
                    </div>

                    {analysis?.error_message ? (
                      <p className="mt-1 text-xs text-rose-700">{analysis.error_message}</p>
                    ) : null}

                    {topFindings.length > 0 ? (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {topFindings.map((finding) => (
                          <li key={finding.id}>
                            <Badge tone={FINDING_SEVERITY_TONE[finding.severity]}>
                              {finding.title} (+{finding.points})
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </form>
    </div>
  );
}

function AnalyzeButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending || count === 0}>
      {pending ? "Analyse läuft …" : `${count} analysieren`}
    </Button>
  );
}
