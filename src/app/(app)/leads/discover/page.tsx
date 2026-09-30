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
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  LinkButton,
  PageHeader,
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
    loadDiscoveryRuns(session.organizationId, 10),
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
        description="Firmen nach Ort, Radius und Branche finden und als Leads übernehmen."
        actions={
          <LinkButton href="/qualifizierung" variant="secondary">
            Zur Qualifizierung
          </LinkButton>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Suche</CardTitle>
              <Badge>{provider.label}</Badge>
            </CardHeader>
            <CardBody>
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
            </CardBody>
          </Card>

          {activeRun ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Treffer: {activeRun.industry_label ?? activeRun.industry} ·{" "}
                  {activeRun.resolved_place ?? activeRun.city}
                </CardTitle>
                <span className="text-xs text-slate-500">
                  {activeRun.radius_km} km · {formatDateTime(activeRun.created_at)}
                </span>
              </CardHeader>
              <CardBody>
                {activeRun.status === "FAILED" ? (
                  <Alert tone="error" title="Suche fehlgeschlagen">
                    {activeRun.error_message ?? "Es liegen keine weiteren Angaben vor."}
                  </Alert>
                ) : (
                  <DiscoveryResults runId={activeRun.id} candidates={candidates} />
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>So funktioniert es</CardTitle>
            </CardHeader>
            <CardBody>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
                <li>Ort, Radius, Branche und maximale Trefferzahl wählen.</li>
                <li>Trefferliste prüfen – Duplikate und Firmen ohne Website sind markiert.</li>
                <li>Passende Firmen auswählen und als Leads importieren.</li>
                <li>
                  In der <Link href="/qualifizierung" className="underline">Qualifizierung</Link>{" "}
                  die Websites im Stapel analysieren.
                </li>
                <li>Nach Potenzial sortieren, Lead öffnen, in die Pipeline übernehmen.</li>
              </ol>
              <p className="mt-3 text-xs text-slate-500">{provider.attribution}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Letzte Suchen</CardTitle>
            </CardHeader>
            {runs.length === 0 ? (
              <CardBody className="text-sm text-slate-500">Noch keine Suche durchgeführt.</CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {runs.map((run) => (
                  <li key={run.id} className="px-4 py-2.5">
                    <Link
                      href={`/leads/discover?run=${run.id}`}
                      className="text-sm font-medium text-slate-800 hover:underline"
                    >
                      {run.industry_label ?? run.industry} · {run.city}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {formatDateTime(run.created_at)} · {run.radius_km} km ·{" "}
                      {DISCOVERY_RUN_STATUS_LABELS[run.status]}
                    </p>
                    {run.status === "SUCCESS" ? (
                      <p className="text-[11px] text-slate-500">
                        {run.result_count} Treffer · {run.new_count} neu · {run.imported_count}{" "}
                        importiert
                      </p>
                    ) : null}
                    {run.status === "FAILED" && run.error_message ? (
                      <p className="text-[11px] text-rose-600">{run.error_message}</p>
                    ) : null}
                    <p className="text-[11px] text-slate-400">{providerLabel(run.provider)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
