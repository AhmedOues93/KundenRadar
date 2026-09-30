"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { importCandidates } from "@/lib/actions/discovery";
import { MATCH_STATUS_LABELS, MATCH_STATUS_TONE, providerLabel } from "@/lib/discovery/labels";
import type { DiscoveryCandidateRow } from "@/lib/discovery/queries";
import { Alert, Badge, Button, EmptyState } from "@/components/ui";
import type { ActionState } from "@/lib/actions/shared";
import { displayUrl } from "@/lib/utils";

const INITIAL: ActionState = { ok: true };

type Filter = "SENSIBLE" | "NEW" | "WITH_WEBSITE" | "WITHOUT_WEBSITE" | "DUPLICATE" | "ALL";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "SENSIBLE", label: "Sinnvolle Treffer" },
  { key: "NEW", label: "Neu" },
  { key: "WITH_WEBSITE", label: "Mit Website" },
  { key: "WITHOUT_WEBSITE", label: "Ohne Website" },
  { key: "DUPLICATE", label: "Duplikate" },
  { key: "ALL", label: "Alle" },
];

/** Ein Treffer ist „sinnvoll", wenn er neu ist und eine Website hat. */
function isSensible(row: DiscoveryCandidateRow): boolean {
  return row.match_status === "NEW" && Boolean(row.website_url) && !row.imported_lead_id;
}

function matchesFilter(row: DiscoveryCandidateRow, filter: Filter): boolean {
  switch (filter) {
    case "SENSIBLE":
      return isSensible(row);
    case "NEW":
      return row.match_status === "NEW";
    case "WITH_WEBSITE":
      return Boolean(row.website_url);
    case "WITHOUT_WEBSITE":
      return !row.website_url;
    case "DUPLICATE":
      return row.match_status !== "NEW";
    case "ALL":
      return true;
  }
}

/**
 * Trefferliste mit Auswahl. Bewusst als Kartenliste statt als Tabelle, damit
 * die Bedienung auf dem Smartphone vollständig funktioniert.
 */
export function DiscoveryResults({
  runId,
  candidates,
}: {
  runId: string;
  candidates: DiscoveryCandidateRow[];
}) {
  const [state, action] = useActionState(importCandidates, INITIAL);
  const [filter, setFilter] = useState<Filter>("SENSIBLE");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () => candidates.filter((row) => matchesFilter(row, filter)),
    [candidates, filter],
  );

  /** Nur neue, noch nicht importierte Treffer sind auswählbar. */
  const selectable = useMemo(
    () => visible.filter((row) => row.match_status === "NEW" && !row.imported_lead_id),
    [visible],
  );

  const counts = useMemo(
    () => ({
      total: candidates.length,
      sensible: candidates.filter(isSensible).length,
      withoutWebsite: candidates.filter((row) => !row.website_url).length,
      duplicates: candidates.filter((row) => row.match_status !== "NEW").length,
      imported: candidates.filter((row) => row.imported_lead_id).length,
    }),
    [candidates],
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      for (const row of selectable) next.add(row.id);
      return next;
    });
  }

  function selectSensible() {
    setSelected(new Set(candidates.filter(isSensible).map((row) => row.id)));
  }

  if (candidates.length === 0) {
    return (
      <EmptyState
        title="Keine Treffer"
        description="Die Datenquelle hat für diese Suche keine Firmen mit Namen geliefert. Ein grösserer Radius oder eine andere Branche kann helfen."
      />
    );
  }

  return (
    <div className="space-y-3">
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Stat label="Treffer" value={counts.total} />
        <Stat label="Sinnvoll" value={counts.sensible} />
        <Stat label="Ohne Website" value={counts.withoutWebsite} />
        <Stat label="Duplikate" value={counts.duplicates} />
      </dl>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Treffer filtern">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            aria-pressed={filter === option.key}
            className={
              filter === option.key
                ? "rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                : "rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="runId" value={runId} />
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="candidateId" value={id} />
        ))}

        <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          <span className="text-xs font-medium text-slate-600">
            {selected.size} ausgewählt
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button type="button" variant="secondary" size="sm" onClick={selectSensible}>
              Alle sinnvollen wählen
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={selectAllVisible}
              disabled={selectable.length === 0}
            >
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
            <ImportButton count={selected.size} />
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState title="Keine Treffer für diesen Filter" />
        ) : (
          <ul className="space-y-2">
            {visible.map((row) => {
              const isSelectable = row.match_status === "NEW" && !row.imported_lead_id;
              const checked = selected.has(row.id);

              return (
                <li
                  key={row.id}
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
                      onChange={() => toggle(row.id)}
                      disabled={!isSelectable}
                      aria-label={`${row.company_name} auswählen`}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 disabled:opacity-40"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-medium text-slate-900">{row.company_name}</p>
                        {row.imported_lead_id ? (
                          <Badge tone="bg-sky-50 text-sky-700 ring-sky-200">Importiert</Badge>
                        ) : (
                          <Badge tone={MATCH_STATUS_TONE[row.match_status]}>
                            {MATCH_STATUS_LABELS[row.match_status]}
                          </Badge>
                        )}
                        {!row.website_url ? (
                          <Badge tone="bg-amber-50 text-amber-800 ring-amber-200">
                            Ohne Website
                          </Badge>
                        ) : null}
                      </div>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {[row.industry, row.street, [row.postal_code, row.city].filter(Boolean).join(" ")]
                          .filter(Boolean)
                          .join(" · ") || "Keine Adressangaben"}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                        {row.website_url ? (
                          <a
                            href={row.website_url}
                            target="_blank"
                            rel="noreferrer noopener nofollow"
                            className="text-slate-700 hover:underline"
                          >
                            {displayUrl(row.website_url, 34)}
                          </a>
                        ) : null}
                        {row.phone ? <span className="text-slate-500">{row.phone}</span> : null}
                        {row.source_url ? (
                          <a
                            href={row.source_url}
                            target="_blank"
                            rel="noreferrer noopener nofollow"
                            className="text-slate-400 hover:underline"
                          >
                            Quelle: {providerLabel(row.provider)}
                          </a>
                        ) : (
                          <span className="text-slate-400">
                            Quelle: {providerLabel(row.provider)}
                          </span>
                        )}
                      </div>

                      {row.existing_lead_id ? (
                        <p className="mt-1 text-xs">
                          <Link
                            href={`/leads/${row.existing_lead_id}`}
                            className="text-slate-600 underline"
                          >
                            Vorhandenen Lead öffnen
                          </Link>
                        </p>
                      ) : null}
                      {row.imported_lead_id ? (
                        <p className="mt-1 text-xs">
                          <Link
                            href={`/leads/${row.imported_lead_id}`}
                            className="text-slate-600 underline"
                          >
                            Importierten Lead öffnen
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </form>
    </div>
  );
}

function ImportButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending || count === 0}>
      {pending ? "Import läuft …" : `${count} importieren`}
    </Button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
