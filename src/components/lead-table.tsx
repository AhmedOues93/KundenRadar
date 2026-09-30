import Link from "next/link";
import { AgencyBadge, LeadStatusBadge, ScoreBadge } from "@/components/badges";
import { EmptyState } from "@/components/ui";
import type { Lead } from "@/lib/types";
import { displayUrl, formatDate } from "@/lib/utils";

/**
 * Tabelle auf grossen Bildschirmen, Kartenliste auf kleinen. So bleibt die
 * Spaltenvielfalt auf dem Desktop erhalten, ohne mobil zu scrollen.
 */
export function LeadTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <EmptyState
        title="Keine Leads gefunden"
        description="Passe die Filter an oder erfasse einen neuen Lead."
      />
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
              <th scope="col" className="px-4 py-2">Firma</th>
              <th scope="col" className="px-4 py-2">Ort</th>
              <th scope="col" className="px-4 py-2">Branche</th>
              <th scope="col" className="px-4 py-2">Website</th>
              <th scope="col" className="px-4 py-2">Potenzial</th>
              <th scope="col" className="px-4 py-2">Status</th>
              <th scope="col" className="px-4 py-2">Letzte Analyse</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr key={lead.id} className="align-middle hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {lead.company_name}
                  </Link>
                  {lead.has_agency ? (
                    <div className="mt-1">
                      <AgencyBadge hasAgency name={lead.detected_agency_name} />
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {[lead.postal_code, lead.city].filter(Boolean).join(" ") || "–"}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{lead.industry ?? "–"}</td>
                <td className="px-4 py-2.5">
                  {lead.website_url ? (
                    <a
                      href={lead.website_url}
                      target="_blank"
                      rel="noreferrer noopener nofollow"
                      className="text-slate-600 hover:underline"
                    >
                      {displayUrl(lead.website_url, 30)}
                    </a>
                  ) : (
                    <span className="text-slate-400">–</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <ScoreBadge score={lead.potential_score} />
                </td>
                <td className="px-4 py-2.5">
                  <LeadStatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                  {formatDate(lead.last_analyzed_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-slate-100 md:hidden">
        {leads.map((lead) => (
          <li key={lead.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/leads/${lead.id}`} className="font-medium text-slate-900">
                {lead.company_name}
              </Link>
              <LeadStatusBadge status={lead.status} />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {[lead.postal_code, lead.city, lead.industry].filter(Boolean).join(" · ") ||
                "Keine weiteren Angaben"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <ScoreBadge score={lead.potential_score} />
              {lead.has_agency ? (
                <AgencyBadge hasAgency name={lead.detected_agency_name} />
              ) : null}
            </div>
            {lead.last_analyzed_at ? (
              <p className="mt-1.5 text-[11px] text-slate-400">
                Letzte Analyse: {formatDate(lead.last_analyzed_at)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
