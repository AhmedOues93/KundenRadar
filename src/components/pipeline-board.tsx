"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { changeLeadStatus } from "@/lib/actions/leads";
import { LEAD_STATUS_LABELS, PIPELINE_COLUMNS } from "@/lib/constants";
import type { Lead, LeadStatus } from "@/lib/types";
import { Alert } from "@/components/ui";
import { cn } from "@/lib/utils";

type Move = { leadId: string; status: LeadStatus };

/**
 * Akquise-Pipeline.
 *
 * Auf dem Desktop ein Raster, in dem alle acht Spalten ohne Scrollen passen;
 * auf schmalen Bildschirmen eine horizontal scrollbare Reihe. Verschoben wird
 * per Drag & Drop (native HTML5-API, keine zusätzliche Abhängigkeit); jede
 * Karte hat zusätzlich ein Auswahlfeld, damit der Wechsel auch per Tastatur
 * und auf Touch-Geräten möglich ist.
 */
export function PipelineBoard({ leads }: { leads: Lead[] }) {
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);
  const [, startTransition] = useTransition();

  const [optimisticLeads, applyMove] = useOptimistic(leads, (current, move: Move) =>
    current.map((lead) => (lead.id === move.leadId ? { ...lead, status: move.status } : lead)),
  );

  function move(leadId: string, status: LeadStatus) {
    const lead = optimisticLeads.find((candidate) => candidate.id === leadId);
    if (!lead || lead.status === status) return;

    setError(null);
    startTransition(async () => {
      applyMove({ leadId, status });
      const formData = new FormData();
      formData.set("leadId", leadId);
      formData.set("status", status);
      const result = await changeLeadStatus({ ok: true }, formData);
      if (!result.ok) setError(result.message ?? "Der Status konnte nicht geändert werden.");
    });
  }

  return (
    <div className="space-y-2">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="kr-scroll -mx-3 overflow-x-auto px-3 pb-1 lg:mx-0 lg:overflow-visible lg:px-0">
        <div className="flex min-w-max gap-1.5 lg:grid lg:min-w-0 lg:grid-cols-8">
          {PIPELINE_COLUMNS.map((column) => {
            const statuses = new Set<LeadStatus>([column.status, ...(column.absorbs ?? [])]);
            const columnLeads = optimisticLeads.filter((lead) => statuses.has(lead.status));

            return (
              <section
                key={column.status}
                aria-label={column.label}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(column.status);
                }}
                onDragLeave={() =>
                  setDragOver((current) => (current === column.status ? null : current))
                }
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(null);
                  const leadId = event.dataTransfer.getData("text/plain");
                  if (leadId) move(leadId, column.status);
                }}
                className={cn(
                  "flex w-44 min-w-0 shrink-0 flex-col rounded border bg-slate-50/70 transition-colors lg:w-auto",
                  dragOver === column.status
                    ? "border-blue-400 bg-blue-50/60"
                    : "border-[var(--kr-line)]",
                )}
              >
                <header className="flex items-center justify-between gap-1 border-b border-[var(--kr-line)] px-2 py-1">
                  <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.03em] text-slate-600">
                    {column.label}
                  </h2>
                  <span className="tabnum rounded bg-white px-1 text-[10.5px] font-medium text-slate-500">
                    {columnLeads.length}
                  </span>
                </header>

                <ul className="flex-1 space-y-1 p-1">
                  {columnLeads.length === 0 ? (
                    <li className="px-1 py-3 text-center text-[10.5px] text-slate-400">leer</li>
                  ) : (
                    columnLeads.map((lead) => (
                      <li
                        key={lead.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", lead.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        className="group cursor-grab rounded border border-[var(--kr-line)] bg-white px-1.5 py-1 active:cursor-grabbing"
                      >
                        <Link
                          href={`/leads/${lead.id}`}
                          className="block truncate text-[12px] font-medium text-slate-900 hover:text-blue-700 hover:underline"
                          title={lead.company_name}
                        >
                          {lead.company_name}
                        </Link>
                        <p className="truncate text-[10.5px] text-slate-500">
                          {[lead.city, lead.industry].filter(Boolean).join(" · ") || "—"}
                        </p>

                        <div className="mt-0.5 flex items-center justify-between gap-1">
                          {lead.potential_score !== null ? (
                            <span className="tabnum text-[10.5px] font-medium text-slate-700">
                              {lead.potential_score}
                              <span className="ml-0.5 font-normal text-slate-400">/100</span>
                            </span>
                          ) : (
                            <span className="text-[10.5px] text-slate-400">nicht analysiert</span>
                          )}
                          {lead.has_agency ? (
                            <span
                              aria-hidden
                              title={`Agenturhinweis${lead.detected_agency_name ? `: ${lead.detected_agency_name}` : ""}`}
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500"
                            />
                          ) : null}
                        </div>

                        <label className="mt-0.5 block">
                          <span className="sr-only">Status von {lead.company_name} ändern</span>
                          <select
                            value={lead.status}
                            onChange={(event) => move(lead.id, event.target.value as LeadStatus)}
                            className="w-full rounded border border-transparent bg-transparent py-px text-[10.5px] text-slate-500 opacity-60 transition hover:border-[var(--kr-line)] hover:bg-slate-50 hover:opacity-100 focus:border-blue-600 focus:opacity-100 group-hover:opacity-100"
                          >
                            {PIPELINE_COLUMNS.map((option) => (
                              <option key={option.status} value={option.status}>
                                {LEAD_STATUS_LABELS[option.status]}
                              </option>
                            ))}
                            {!PIPELINE_COLUMNS.some((option) => option.status === lead.status) ? (
                              <option value={lead.status}>{LEAD_STATUS_LABELS[lead.status]}</option>
                            ) : null}
                          </select>
                        </label>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        Karten per Drag &amp; Drop verschieben oder den Status direkt auf der Karte auswählen.
      </p>
    </div>
  );
}
