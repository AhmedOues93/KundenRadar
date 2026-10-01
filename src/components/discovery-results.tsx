"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { importCandidates } from "@/lib/actions/discovery";
import { MATCH_STATUS_LABELS, MATCH_STATUS_TONE, providerLabel } from "@/lib/discovery/labels";
import type { DiscoveryCandidateRow } from "@/lib/discovery/queries";
import {
  Alert,
  Badge,
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
import type { ActionState } from "@/lib/actions/shared";
import { cn, displayUrl } from "@/lib/utils";

const INITIAL: ActionState = { ok: true };

type Filter = "SENSIBLE" | "NEW" | "WITHOUT_WEBSITE" | "DUPLICATE" | "ALL";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "SENSIBLE", label: "Sinnvoll" },
  { key: "NEW", label: "Neu" },
  { key: "WITHOUT_WEBSITE", label: "Ohne Website" },
  { key: "DUPLICATE", label: "Duplikate" },
  { key: "ALL", label: "Alle" },
];

/** Sinnvoll = neu, mit Website, noch nicht importiert. */
function isSensible(row: DiscoveryCandidateRow): boolean {
  return row.match_status === "NEW" && Boolean(row.website_url) && !row.imported_lead_id;
}

function matchesFilter(row: DiscoveryCandidateRow, filter: Filter): boolean {
  switch (filter) {
    case "SENSIBLE":
      return isSensible(row);
    case "NEW":
      return row.match_status === "NEW";
    case "WITHOUT_WEBSITE":
      return !row.website_url;
    case "DUPLICATE":
      return row.match_status !== "NEW";
    case "ALL":
      return true;
  }
}

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
  const selectable = useMemo(
    () => visible.filter((row) => row.match_status === "NEW" && !row.imported_lead_id),
    [visible],
  );
  const sinnvoll = useMemo(() => candidates.filter(isSensible), [candidates]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    <form action={action}>
      <input type="hidden" name="runId" value={runId} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="candidateId" value={id} />
      ))}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-[var(--kr-line)] bg-slate-50/60 px-3 py-1.5">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Treffer filtern">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              aria-pressed={filter === option.key}
              className={cn(
                "rounded px-1.5 py-0.5 text-[11.5px] font-medium transition-colors",
                filter === option.key
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-200/60",
              )}
            >
              {option.label}
              <span className="ml-1 opacity-60">
                {candidates.filter((row) => matchesFilter(row, option.key)).length}
              </span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-slate-600">
            <span className="tabnum font-medium text-slate-900">{selected.size}</span> ausgewählt
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set(sinnvoll.map((row) => row.id)))}
            disabled={sinnvoll.length === 0}
          >
            Alle sinnvollen ({sinnvoll.length})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setSelected((current) => {
                const next = new Set(current);
                for (const row of selectable) next.add(row.id);
                return next;
              })
            }
            disabled={selectable.length === 0}
          >
            Sichtbare
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
            disabled={selected.size === 0}
          >
            Leeren
          </Button>
          <ImportButton count={selected.size} />
        </div>
      </div>

      {state.message ? (
        <div className="px-3 py-2">
          <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState compact title="Keine Treffer für diesen Filter" />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th className="w-8" />
                <Th>Firma</Th>
                <Th className="hidden md:table-cell">Adresse</Th>
                <Th className="hidden lg:table-cell">Website</Th>
                <Th className="hidden xl:table-cell">Telefon</Th>
                <Th>Abgleich</Th>
                <Th className="hidden sm:table-cell">Quelle</Th>
              </tr>
            </Thead>
            <tbody>
              {visible.map((row) => {
                const auswaehlbar = row.match_status === "NEW" && !row.imported_lead_id;
                const checked = selected.has(row.id);
                return (
                  <Tr key={row.id} className={cn(checked && "bg-blue-50/50 hover:bg-blue-50")}>
                    <Td className="w-8">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(row.id)}
                        disabled={!auswaehlbar}
                        aria-label={`${row.company_name} auswählen`}
                        className="h-3.5 w-3.5 rounded border-slate-300 disabled:opacity-30"
                      />
                    </Td>
                    <Td className="max-w-[18rem]">
                      <span className="block truncate font-medium text-slate-900">
                        {row.company_name}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500 md:hidden">
                        {[row.street, row.city].filter(Boolean).join(", ")}
                      </span>
                    </Td>
                    <Td className="hidden max-w-[18rem] truncate text-slate-600 md:table-cell">
                      {[row.street, [row.postal_code, row.city].filter(Boolean).join(" ")]
                        .filter(Boolean)
                        .join(", ") || <Blank />}
                    </Td>
                    <Td className="hidden max-w-[16rem] lg:table-cell">
                      {row.website_url ? (
                        <a
                          href={row.website_url}
                          target="_blank"
                          rel="noreferrer noopener nofollow"
                          className="block truncate text-slate-600 hover:text-blue-700 hover:underline"
                        >
                          {displayUrl(row.website_url, 32)}
                        </a>
                      ) : (
                        <span className="text-[11.5px] text-amber-700">keine Website</span>
                      )}
                    </Td>
                    <Td className="hidden whitespace-nowrap text-slate-600 xl:table-cell">
                      {row.phone ?? <Blank />}
                    </Td>
                    <Td>
                      {row.imported_lead_id ? (
                        <Link
                          href={`/leads/${row.imported_lead_id}`}
                          className="hover:underline"
                          title="Importierten Lead öffnen"
                        >
                          <Badge tone="bg-sky-50 text-sky-700 ring-sky-200">Importiert</Badge>
                        </Link>
                      ) : row.existing_lead_id ? (
                        <Link
                          href={`/leads/${row.existing_lead_id}`}
                          className="hover:underline"
                          title="Vorhandenen Lead öffnen"
                        >
                          <Badge tone={MATCH_STATUS_TONE[row.match_status]}>
                            {MATCH_STATUS_LABELS[row.match_status]}
                          </Badge>
                        </Link>
                      ) : (
                        <Badge tone={MATCH_STATUS_TONE[row.match_status]}>
                          {MATCH_STATUS_LABELS[row.match_status]}
                        </Badge>
                      )}
                    </Td>
                    <Td className="hidden sm:table-cell">
                      {row.source_url ? (
                        <a
                          href={row.source_url}
                          target="_blank"
                          rel="noreferrer noopener nofollow"
                          className="text-[11.5px] text-slate-400 hover:text-blue-700 hover:underline"
                        >
                          {providerLabel(row.provider)}
                        </a>
                      ) : (
                        <span className="text-[11.5px] text-slate-400">
                          {providerLabel(row.provider)}
                        </span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </form>
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
