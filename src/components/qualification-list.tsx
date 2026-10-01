"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { analyzeLeadsBatch } from "@/lib/actions/discovery";
import { BATCH_DEFAULTS } from "@/lib/analysis/batch-limits";
import { AgencyDot, AnalysisStatusBadge, ScoreCell } from "@/components/badges";
import {
  Alert,
  Blank,
  Button,
  EmptyState,
  Table,
  TableWrap,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui";
import type { QualificationRow } from "@/lib/queries";
import type { ActionState } from "@/lib/actions/shared";
import { cn, displayUrl, formatDate } from "@/lib/utils";

const INITIAL: ActionState = { ok: true };

/**
 * Qualifizierungstabelle mit Mehrfachauswahl für die Stapel-Analyse.
 * Die Reihenfolge kommt aus der Datenbank: höchstes Analysepotenzial zuerst.
 */
export function QualificationList({ rows }: { rows: QualificationRow[] }) {
  const [state, action] = useActionState(analyzeLeadsBatch, INITIAL);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const analysierbar = useMemo(
    () => rows.filter((row) => Boolean(row.lead.website_url)),
    [rows],
  );
  const offen = useMemo(() => analysierbar.filter((row) => !row.analysis), [analysierbar]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function waehle(auswahl: QualificationRow[]) {
    setSelected(new Set(auswahl.slice(0, BATCH_DEFAULTS.maxItems).map((row) => row.lead.id)));
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Keine Leads für diese Filter"
        description="Passe die Filter an oder starte eine neue Lead-Suche."
      />
    );
  }

  const alleGewaehlt = selected.size > 0 && selected.size >= Math.min(analysierbar.length, BATCH_DEFAULTS.maxItems);

  return (
    <form action={action}>
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="leadId" value={id} />
      ))}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-[var(--kr-line)] bg-slate-50/60 px-3 py-1.5">
        <span className="text-[12px] text-slate-600">
          <span className="tabnum font-medium text-slate-900">{selected.size}</span> ausgewählt
        </span>
        <span className="text-[11px] text-slate-400">
          max. {BATCH_DEFAULTS.maxItems} je Durchlauf · {BATCH_DEFAULTS.concurrency} gleichzeitig
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => waehle(offen)}
            disabled={offen.length === 0}
          >
            Nicht analysierte ({offen.length})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => (alleGewaehlt ? setSelected(new Set()) : waehle(analysierbar))}
          >
            {alleGewaehlt ? "Auswahl leeren" : "Alle wählen"}
          </Button>
          <AnalyzeButton count={selected.size} />
        </div>
      </div>

      {state.message ? (
        <div className="px-3 py-2">
          <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
        </div>
      ) : null}

      <TableWrap>
        <Table>
          <Thead>
            <tr>
              <Th className="w-8" />
              <Th>Firma</Th>
              <Th align="right">Potenzial</Th>
              <Th className="hidden lg:table-cell">Wichtigste Findings</Th>
              <Th className="hidden md:table-cell">Agentur</Th>
              <Th>Analyse</Th>
              <Th align="right" className="hidden sm:table-cell">
                Zuletzt
              </Th>
            </tr>
          </Thead>
          <tbody>
            {rows.map(({ lead, analysis }) => {
              const checked = selected.has(lead.id);
              const top = (analysis?.findings ?? [])
                .filter((finding) => finding.points > 0)
                .sort((a, b) => b.points - a.points)
                .slice(0, 3);

              return (
                <Tr key={lead.id} className={cn(checked && "bg-blue-50/50 hover:bg-blue-50")}>
                  <Td className="w-8">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(lead.id)}
                      disabled={!lead.website_url}
                      aria-label={`${lead.company_name} für die Analyse auswählen`}
                      className="h-3.5 w-3.5 rounded border-slate-300 disabled:opacity-30"
                    />
                  </Td>
                  <Td className="max-w-[20rem]">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="block truncate font-medium text-slate-900 hover:text-blue-700 hover:underline"
                    >
                      {lead.company_name}
                    </Link>
                    <span className="block truncate text-[11px] text-slate-500">
                      {lead.website_url ? (
                        displayUrl(lead.website_url, 40)
                      ) : (
                        <span className="text-amber-700">Keine Website hinterlegt</span>
                      )}
                      {lead.city ? ` · ${lead.city}` : ""}
                    </span>
                  </Td>
                  <Td align="right" className="whitespace-nowrap">
                    <ScoreCell score={lead.potential_score} />
                  </Td>
                  <Td className="hidden max-w-[26rem] lg:table-cell">
                    {top.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {top.map((finding) => (
                          <span
                            key={finding.id}
                            className="rounded bg-slate-100 px-1.5 py-px text-[11px] text-slate-700"
                          >
                            {finding.title}
                            <span className="ml-1 text-slate-400">+{finding.points}</span>
                          </span>
                        ))}
                      </span>
                    ) : analysis?.error_message ? (
                      <span className="text-[11.5px] text-rose-700">{analysis.error_message}</span>
                    ) : (
                      <Blank />
                    )}
                  </Td>
                  <Td className="hidden md:table-cell">
                    <AgencyDot hasAgency={lead.has_agency} name={lead.detected_agency_name} />
                  </Td>
                  <Td>
                    {analysis ? (
                      <AnalysisStatusBadge status={analysis.status} />
                    ) : (
                      <span className="text-[11.5px] text-slate-400">offen</span>
                    )}
                  </Td>
                  <Td align="right" className="hidden whitespace-nowrap text-slate-500 sm:table-cell">
                    {analysis ? formatDate(analysis.created_at) : <Blank />}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>
    </form>
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
