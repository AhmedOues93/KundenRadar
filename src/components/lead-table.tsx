import Link from "next/link";
import { AgencyDot, LeadStatusBadge, ScoreCell } from "@/components/badges";
import {
  Blank,
  EmptyState,
  SortableTh,
  Table,
  TableWrap,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui";
import type { Lead } from "@/lib/types";
import { displayUrl, formatDate } from "@/lib/utils";

/**
 * Lead-Tabelle. Eine Darstellung für alle Breiten: auf schmalen Bildschirmen
 * werden Nebenspalten ausgeblendet, die Tabelle bleibt aber eine Tabelle.
 */
export function LeadTable({
  leads,
  sort,
  hrefForSort,
  emptyAction,
  compact = false,
}: {
  leads: Lead[];
  /** Aktive Sortierung; ohne Angabe werden die Spaltenköpfe nicht verlinkt. */
  sort?: string;
  hrefForSort?: (key: string) => string;
  emptyAction?: React.ReactNode;
  /** Für schmale Spalten (z. B. Dashboard): Branche und Website entfallen. */
  compact?: boolean;
}) {
  if (leads.length === 0) {
    return (
      <EmptyState
        title="Keine Leads gefunden"
        description="Passe die Filter an oder erfasse einen neuen Lead."
        action={emptyAction}
      />
    );
  }

  const sortable = Boolean(sort && hrefForSort);

  return (
    <TableWrap>
      <Table>
        <Thead>
          <tr>
            {sortable ? (
              <SortableTh label="Firma" sortKey="company" current={sort as string} hrefFor={hrefForSort!} />
            ) : (
              <Th>Firma</Th>
            )}
            <Th className="hidden md:table-cell">Ort</Th>
            {compact ? null : <Th className="hidden lg:table-cell">Branche</Th>}
            {compact ? null : <Th className="hidden xl:table-cell">Website</Th>}
            {sortable ? (
              <SortableTh
                label="Potenzial"
                sortKey="score"
                current={sort as string}
                hrefFor={hrefForSort!}
                align="right"
              />
            ) : (
              <Th align="right">Potenzial</Th>
            )}
            <Th className="hidden lg:table-cell">Agentur</Th>
            <Th>Status</Th>
            {sortable ? (
              <SortableTh
                label="Analyse"
                sortKey="created"
                current={sort as string}
                hrefFor={hrefForSort!}
                align="right"
                className="hidden sm:table-cell"
              />
            ) : (
              <Th align="right" className="hidden sm:table-cell">
                Analyse
              </Th>
            )}
          </tr>
        </Thead>
        <tbody>
          {leads.map((lead) => (
            <Tr key={lead.id}>
              <Td className={compact ? "max-w-[15rem]" : "max-w-[22rem]"}>
                <Link
                  href={`/leads/${lead.id}`}
                  className="block truncate font-medium text-slate-900 hover:text-blue-700 hover:underline"
                >
                  {lead.company_name}
                </Link>
                <span className="text-[11px] text-slate-400 md:hidden">
                  {[lead.postal_code, lead.city].filter(Boolean).join(" ")}
                </span>
              </Td>
              <Td className="hidden whitespace-nowrap text-slate-600 md:table-cell">
                {[lead.postal_code, lead.city].filter(Boolean).join(" ") || <Blank />}
              </Td>
              {compact ? null : (
                <Td className="hidden max-w-[12rem] truncate text-slate-600 lg:table-cell">
                  {lead.industry ?? <Blank />}
                </Td>
              )}
              {compact ? null : (
                <Td className="hidden max-w-[16rem] xl:table-cell">
                  {lead.website_url ? (
                    <a
                      href={lead.website_url}
                      target="_blank"
                      rel="noreferrer noopener nofollow"
                      className="block truncate text-slate-600 hover:text-blue-700 hover:underline"
                    >
                      {displayUrl(lead.website_url, 34)}
                    </a>
                  ) : (
                    <Blank />
                  )}
                </Td>
              )}
              <Td align="right" className="whitespace-nowrap">
                <ScoreCell score={lead.potential_score} />
              </Td>
              <Td className="hidden lg:table-cell">
                <AgencyDot hasAgency={lead.has_agency} name={lead.detected_agency_name} />
              </Td>
              <Td>
                <LeadStatusBadge status={lead.status} />
              </Td>
              <Td align="right" className="hidden whitespace-nowrap text-slate-500 sm:table-cell">
                {lead.last_analyzed_at ? formatDate(lead.last_analyzed_at) : <Blank />}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}
