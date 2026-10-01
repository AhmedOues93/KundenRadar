import type { Metadata } from "next";
import Link from "next/link";
import { requireSessionContext } from "@/lib/auth";
import {
  loadDiscoveryCandidates,
  loadDiscoveryRun,
  loadDiscoveryRuns,
} from "@/lib/discovery/queries";
import { DISCOVERY_RUN_STATUS_LABELS, providerLabel } from "@/lib/discovery/labels";
import { getProvider } from "@/lib/discovery/registry";
import { DiscoveryForm } from "@/components/discovery-form";
import { DiscoveryResults } from "@/components/discovery-results";
import {
  Alert,
  EmptyState,
  LinkButton,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Lead-Suche" };
export const dynamic = "force-dynamic";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const session = await requireSessionContext();
  const params = await searchParams;

  const [runs, activeRun] = await Promise.all([
    loadDiscoveryRuns(session.organizationId, 12),
    params.run ? loadDiscoveryRun(session.organizationId, params.run) : Promise.resolve(null),
  ]);

  const candidates = activeRun
    ? await loadDiscoveryCandidates(session.organizationId, activeRun.id)
    : [];

  const provider = getProvider();

  return (
    <>
      <PageHeader
        title="Lead-Suche"
        meta={provider.label}
        description="Firmen nach Ort, Radius und Branche finden, prüfen und als Leads übernehmen."
        actions={<LinkButton href="/qualifizierung">Zur Qualifizierung</LinkButton>}
      />

      <Panel>
        <PanelBody className="bg-slate-50/50">
          <DiscoveryForm
            defaults={
              activeRun
                ? {
                    city: activeRun.city,
                    radiusKm: activeRun.radius_km,
                    industry: activeRun.industry,
                    maxResults: activeRun.max_results,
                  }
                : undefined
            }
          />
          <p className="mt-1.5 text-[11px] text-slate-500">
            Datenquelle: OpenStreetMap über die öffentliche Overpass-API ({provider.attribution}).
            Eine Abfrage pro Durchlauf. Kein Scraping von Google Maps oder LinkedIn.
          </p>
        </PanelBody>
      </Panel>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          {activeRun ? (
            <Panel>
              <PanelHeader>
                <PanelTitle>
                  {activeRun.industry_label ?? activeRun.industry} ·{" "}
                  {activeRun.resolved_place ?? activeRun.city}
                </PanelTitle>
                <span className="text-[11px] text-slate-500">
                  {activeRun.radius_km} km · {formatDateTime(activeRun.created_at)} ·{" "}
                  {activeRun.result_count} Treffer, {activeRun.new_count} neu,{" "}
                  {activeRun.imported_count} importiert
                </span>
              </PanelHeader>
              {activeRun.status === "FAILED" ? (
                <PanelBody>
                  <Alert tone="error" title="Suche fehlgeschlagen">
                    {activeRun.error_message ?? "Es liegen keine weiteren Angaben vor."}
                  </Alert>
                </PanelBody>
              ) : (
                <DiscoveryResults runId={activeRun.id} candidates={candidates} />
              )}
            </Panel>
          ) : (
            <Panel>
              <EmptyState
                title="Noch keine Suche ausgewählt"
                description="Starte oben eine Suche oder öffne rechts einen früheren Lauf."
              />
            </Panel>
          )}
        </div>

        <Panel className="h-fit">
          <PanelHeader>
            <PanelTitle>Suchläufe</PanelTitle>
          </PanelHeader>
          {runs.length === 0 ? (
            <PanelBody className="text-xs text-slate-500">Noch keine Suche durchgeführt.</PanelBody>
          ) : (
            <ul className="divide-y divide-[var(--kr-line)]">
              {runs.map((run) => (
                <li
                  key={run.id}
                  className={
                    run.id === activeRun?.id
                      ? "bg-slate-50 px-3 py-1.5"
                      : "px-3 py-1.5 hover:bg-slate-50"
                  }
                >
                  <Link
                    href={`/leads/discover?run=${run.id}`}
                    className="block truncate text-[12.5px] font-medium text-slate-800 hover:text-blue-700"
                  >
                    {run.industry_label ?? run.industry} · {run.city}
                  </Link>
                  <p className="text-[10.5px] text-slate-500">
                    {formatDateTime(run.created_at)} · {run.radius_km} km ·{" "}
                    {DISCOVERY_RUN_STATUS_LABELS[run.status]}
                  </p>
                  {run.status === "SUCCESS" ? (
                    <p className="text-[10.5px] text-slate-400">
                      {run.result_count} Treffer · {run.new_count} neu · {run.imported_count}{" "}
                      importiert · {providerLabel(run.provider)}
                    </p>
                  ) : run.error_message ? (
                    <p className="line-clamp-2 text-[10.5px] text-rose-700">{run.error_message}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
