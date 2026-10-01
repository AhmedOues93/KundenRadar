import type { Metadata } from "next";
import Link from "next/link";
import { requireSessionContext } from "@/lib/auth";
import { loadDashboardStats, loadDiscoveryStats, loadRecentLeads } from "@/lib/queries";
import { loadDiscoveryRuns } from "@/lib/discovery/queries";
import { DISCOVERY_RUN_STATUS_LABELS } from "@/lib/discovery/labels";
import { Funnel } from "@/components/funnel";
import { LeadTable } from "@/components/lead-table";
import {
  LinkButton,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Stat,
  StatStrip,
} from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSessionContext();
  const [stats, discovery, recentLeads, runs] = await Promise.all([
    loadDashboardStats(session.organizationId),
    loadDiscoveryStats(session.organizationId),
    loadRecentLeads(session.organizationId, 12),
    loadDiscoveryRuns(session.organizationId, 4),
  ]);

  const lastRun = runs[0] ?? null;

  return (
    <>
      <PageHeader
        title="Dashboard"
        meta={session.organizationName}
        actions={
          <>
            <LinkButton href="/analysen/neu">Website prüfen</LinkButton>
            <LinkButton href="/leads/neu">Lead hinzufügen</LinkButton>
            <LinkButton href="/leads/discover" variant="primary">
              Lead-Suche starten
            </LinkButton>
          </>
        }
      />

      <StatStrip className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Leads gesamt" value={stats.totalLeads} href="/leads?status=ALL" />
        <Stat
          label="Aus Lead-Suche"
          value={discovery.fromDiscovery}
          href="/leads?status=ALL"
        />
        <Stat label="Analysierte Websites" value={stats.analyzedWebsites} href="/analysen" />
        <Stat
          label="Noch nicht analysiert"
          value={discovery.notAnalyzed}
          href="/qualifizierung?analysis=MISSING"
          tone={discovery.notAnalyzed > 0 ? "text-amber-700" : undefined}
        />
        <Stat
          label="Hohes Potenzial"
          value={discovery.highPotential}
          hint="Analysepotenzial ab 60"
          href="/qualifizierung?score=HIGH"
          tone="text-orange-700"
        />
        <Stat
          label="Agenturhinweise"
          value={discovery.agencyHints}
          href="/qualifizierung?agency=FOUND"
        />
      </StatStrip>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-3">
          <Panel>
            <PanelHeader>
              <PanelTitle>Akquise-Trichter</PanelTitle>
              <Link href="/pipeline" className="text-[11px] text-slate-500 hover:text-slate-900 hover:underline">
                Zur Pipeline
              </Link>
            </PanelHeader>
            <Funnel counts={stats.byStatus} />
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Neueste Leads</PanelTitle>
              <Link href="/leads" className="text-[11px] text-slate-500 hover:text-slate-900 hover:underline">
                Alle Leads
              </Link>
            </PanelHeader>
            <LeadTable
              compact
              leads={recentLeads}
              emptyAction={<LinkButton href="/leads/discover">Lead-Suche starten</LinkButton>}
            />
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel>
            <PanelHeader>
              <PanelTitle>Letzte Suchläufe</PanelTitle>
              <Link
                href="/leads/discover"
                className="text-[11px] text-slate-500 hover:text-slate-900 hover:underline"
              >
                Lead-Suche
              </Link>
            </PanelHeader>
            {lastRun ? (
              <ul className="divide-y divide-[var(--kr-line)]">
                {runs.map((run) => (
                  <li key={run.id} className="px-3 py-1.5">
                    <Link
                      href={`/leads/discover?run=${run.id}`}
                      className="block truncate text-[13px] font-medium text-slate-800 hover:text-blue-700 hover:underline"
                    >
                      {run.industry_label ?? run.industry} · {run.city}
                    </Link>
                    <p className="text-[11px] text-slate-500">
                      {formatDateTime(run.created_at)} · {run.radius_km} km ·{" "}
                      {DISCOVERY_RUN_STATUS_LABELS[run.status]}
                      {run.status === "SUCCESS"
                        ? ` · ${run.result_count} Treffer, ${run.imported_count} importiert`
                        : ""}
                    </p>
                    {run.status === "FAILED" && run.error_message ? (
                      <p className="mt-0.5 text-[11px] text-rose-700">{run.error_message}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <PanelBody className="text-xs text-slate-500">
                Noch keine Suche durchgeführt.
              </PanelBody>
            )}
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Zur Bewertung</PanelTitle>
            </PanelHeader>
            <PanelBody className="text-[12.5px] leading-relaxed text-slate-600">
              Das Analysepotenzial beschreibt, wie interessant eine Website für eine manuelle
              Akquise-Prüfung erscheint – nicht, ob eine Firma Kunde wird. Ein Agenturhinweis
              bedeutet, dass auf der Website ein Hinweis auf eine Agentur gefunden wurde, nicht
              dass eine Zusammenarbeit besteht.
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
