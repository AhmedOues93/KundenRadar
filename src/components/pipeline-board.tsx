"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { changeLeadStatus } from "@/lib/actions/leads";
import { LEAD_STATUS_LABELS, PIPELINE_COLUMNS, scoreBand } from "@/lib/constants";
import type { Lead, LeadStatus } from "@/lib/types";
import { Alert } from "@/components/ui";
import { cn } from "@/lib/utils";

type Move = { leadId: string; status: LeadStatus };

/**
 * Akquise-Pipeline. Drag & Drop über die native HTML5-API (keine zusätzliche
 * Abhängigkeit); zusätzlich hat jede Karte ein Auswahlfeld, damit der Status
 * auch per Tastatur und auf Touch-Geräten geändert werden kann.
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
    <div className="space-y-3">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-3">
          {PIPELINE_COLUMNS.map((column) => {
            const columnStatuses = new Set<LeadStatus>([
              column.status,
              ...(column.absorbs ?? []),
            ]);
            const columnLeads = optimisticLeads.filter((lead) => columnStatuses.has(lead.status));
            return (
              <section
                key={column.status}
                aria-label={column.label}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(column.status);
                }}
                onDragLeave={() => setDragOver((current) => (current === column.status ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(null);
                  const leadId = event.dataTransfer.getData("text/plain");
                  if (leadId) move(leadId, column.status);
                }}
                className={cn(
                  "flex w-64 shrink-0 flex-col rounded-lg border bg-slate-100/70 transition-colors",
                  dragOver === column.status
                    ? "border-slate-400 bg-slate-200/70"
                    : "border-slate-200",
                )}
              >
                <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                  <h2 className="text-xs font-semibold text-slate-700">{column.label}</h2>
                  <span className="rounded-full bg-white px-1.5 text-xs font-medium tabular-nums text-slate-500">
                    {columnLeads.length}
                  </span>
                </header>

                <ul className="flex-1 space-y-2 p-2">
                  {columnLeads.length === 0 ? (
                    <li className="px-1 py-4 text-center text-xs text-slate-400">
                      Keine Leads
                    </li>
                  ) : (
                    columnLeads.map((lead) => (
                      <li
                        key={lead.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", lead.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        className="cursor-grab rounded-md border border-slate-200 bg-white px-2.5 py-2 shadow-sm active:cursor-grabbing"
                      >
                        <Link
                          href={`/leads/${lead.id}`}
                          className="block text-sm font-medium text-slate-900 hover:underline"
                        >
                          {lead.company_name}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {[lead.city, lead.industry].filter(Boolean).join(" · ") || "Keine Angaben"}
                        </p>

                        {lead.potential_score !== null ? (
                          <p className="mt-1 text-[11px] font-medium text-slate-600">
                            Potenzial {lead.potential_score} ·{" "}
                            {scoreBand(lead.potential_score)?.label}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-slate-400">Nicht analysiert</p>
                        )}

                        <label className="mt-2 block">
                          <span className="sr-only">
                            Status von {lead.company_name} ändern
                          </span>
                          <select
                            value={lead.status}
                            onChange={(event) =>
                              move(lead.id, event.target.value as LeadStatus)
                            }
                            className="w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-[11px] text-slate-600"
                          >
                            {PIPELINE_COLUMNS.map((option) => (
                              <option key={option.status} value={option.status}>
                                {LEAD_STATUS_LABELS[option.status]}
                              </option>
                            ))}
                            {!PIPELINE_COLUMNS.some((option) => option.status === lead.status) ? (
                              <option value={lead.status}>
                                {LEAD_STATUS_LABELS[lead.status]}
                              </option>
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

      <p className="text-xs text-slate-500">
        Karten lassen sich per Drag &amp; Drop zwischen den Spalten verschieben. Alternativ kann der
        Status direkt auf der Karte ausgewählt werden.
      </p>
    </div>
  );
}
