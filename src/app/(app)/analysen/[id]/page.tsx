import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSessionContext } from "@/lib/auth";
import { loadAnalysis, loadLead } from "@/lib/queries";
import { AnalysisStatusBadge } from "@/components/badges";
import { FindingGroups, ScoreSummary } from "@/components/findings";
import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { displayUrl, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await requireSessionContext();
  const { id } = await params;
  const analysis = await loadAnalysis(session.organizationId, id);
  return { title: analysis?.domain ? `Analyse ${analysis.domain}` : "Analyse" };
}

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSessionContext();
  const { id } = await params;

  const analysis = await loadAnalysis(session.organizationId, id);
  if (!analysis) notFound();

  const lead = analysis.lead_id
    ? await loadLead(session.organizationId, analysis.lead_id)
    : null;

  const metrics = analysis.metrics;

  return (
    <>
      <PageHeader
        title={analysis.domain ?? displayUrl(analysis.requested_url, 50)}
        description={`Analyse vom ${formatDateTime(analysis.created_at)}`}
        actions={
          <>
            {lead ? (
              <LinkButton href={`/leads/${lead.id}`}>Zum Lead</LinkButton>
            ) : null}
            <LinkButton href="/analysen" variant="ghost">
              Zurück
            </LinkButton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <AnalysisStatusBadge status={analysis.status} />
        {analysis.final_url ? (
          <a
            href={analysis.final_url}
            target="_blank"
            rel="noreferrer noopener nofollow"
            className="text-sm text-slate-600 hover:underline"
          >
            {displayUrl(analysis.final_url, 60)}
          </a>
        ) : null}
      </div>

      {analysis.status !== "SUCCESS" ? (
        <Alert
          tone={analysis.status === "BLOCKED" ? "warning" : "error"}
          title={
            analysis.status === "BLOCKED"
              ? "Analyse abgelehnt"
              : "Analyse fehlgeschlagen"
          }
        >
          {analysis.error_message ?? "Es liegen keine weiteren Angaben vor."}
        </Alert>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <FindingGroups findings={analysis.findings ?? []} />
          </div>

          <div className="space-y-4">
            <ScoreSummary score={analysis.score} findings={analysis.findings ?? []} />

            {analysis.agency_hint ? (
              <Card>
                <CardHeader>
                  <CardTitle>Agenturhinweis</CardTitle>
                </CardHeader>
                <CardBody className="space-y-2 text-sm">
                  {analysis.agency_hint.found ? (
                    <>
                      <p className="font-medium text-slate-800">
                        {analysis.agency_hint.agencyName
                          ? `Agenturhinweis gefunden: ${analysis.agency_hint.agencyName}`
                          : "Agenturhinweis gefunden"}
                      </p>
                      {analysis.agency_hint.evidence ? (
                        <p className="rounded-md bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-600">
                          {analysis.agency_hint.evidence}
                        </p>
                      ) : null}
                      <dl className="space-y-1 text-xs text-slate-500">
                        {analysis.agency_hint.location ? (
                          <div className="flex gap-1">
                            <dt>Fundstelle:</dt>
                            <dd>{analysis.agency_hint.location}</dd>
                          </div>
                        ) : null}
                        {analysis.agency_hint.sourceUrl ? (
                          <div className="flex gap-1">
                            <dt>Quelle:</dt>
                            <dd className="break-all">{analysis.agency_hint.sourceUrl}</dd>
                          </div>
                        ) : null}
                      </dl>
                      <Alert tone="info">
                        Ein gefundener Hinweis belegt nicht, dass aktuell eine Zusammenarbeit mit
                        dieser Agentur besteht.
                      </Alert>
                    </>
                  ) : (
                    <p className="text-slate-600">
                      In den geprüften Bereichen wurde kein Agenturhinweis gefunden. Das ist kein
                      Beweis dafür, dass keine Agentur betreut wird.
                    </p>
                  )}
                </CardBody>
              </Card>
            ) : null}

            {metrics ? (
              <Card>
                <CardHeader>
                  <CardTitle>Technische Messwerte</CardTitle>
                </CardHeader>
                <CardBody>
                  <dl className="space-y-2 text-sm">
                    <Metric label="HTTP-Status" value={metrics.httpStatus ?? "–"} />
                    <Metric label="HTTPS" value={metrics.https ? "ja" : "nein"} />
                    <Metric label="Weiterleitungen" value={metrics.redirectCount} />
                    <Metric
                      label="Antwortzeit"
                      value={metrics.responseTimeMs !== null ? `${metrics.responseTimeMs} ms` : "–"}
                    />
                    <Metric label="Sprachangabe" value={metrics.langAttribute ?? "fehlt"} />
                    <Metric label="Canonical" value={metrics.canonical ? "vorhanden" : "fehlt"} />
                    <Metric label="robots.txt" value={metrics.robotsTxt ? "vorhanden" : "fehlt"} />
                    <Metric label="sitemap.xml" value={metrics.sitemapXml ? "vorhanden" : "fehlt"} />
                    <Metric
                      label="Strukturierte Daten"
                      value={metrics.structuredData ? "vorhanden" : "fehlen"}
                    />
                    <Metric
                      label="Links"
                      value={`${metrics.internalLinks} intern / ${metrics.externalLinks} extern`}
                    />
                    <Metric
                      label="Geprüfte Links"
                      value={`${metrics.checkedLinks} (${metrics.brokenLinks.length} defekt)`}
                    />
                    <Metric
                      label="Bilder"
                      value={`${metrics.imageCount} (${metrics.imagesWithoutAlt} ohne Alt-Text)`}
                    />
                    <Metric
                      label="HTML-Grösse"
                      value={`${Math.max(1, Math.round(metrics.htmlBytes / 1024))} kB`}
                    />
                    {metrics.cmsHints.length > 0 ? (
                      <Metric label="System" value={metrics.cmsHints.join(", ")} />
                    ) : null}
                  </dl>

                  {metrics.redirectChain.length > 1 ? (
                    <div className="mt-3 border-t border-slate-100 pt-2">
                      <p className="text-xs font-medium text-slate-400">Weiterleitungskette</p>
                      <ol className="mt-1 space-y-0.5 text-xs text-slate-600">
                        {metrics.redirectChain.map((url, index) => (
                          <li key={`${url}-${index}`} className="break-all">
                            {index + 1}. {url}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {metrics.brokenLinks.length > 0 ? (
                    <div className="mt-3 border-t border-slate-100 pt-2">
                      <p className="text-xs font-medium text-slate-400">
                        Nicht erreichbare Links (Stichprobe)
                      </p>
                      <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                        {metrics.brokenLinks.map((link) => (
                          <li key={link.url} className="break-all">
                            {link.url} {link.status ? `(${link.status})` : "(keine Antwort)"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            ) : null}

            {lead ? (
              <Card>
                <CardHeader>
                  <CardTitle>Zugehöriger Lead</CardTitle>
                </CardHeader>
                <CardBody>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="text-sm font-medium text-slate-800 hover:underline"
                  >
                    {lead.company_name}
                  </Link>
                </CardBody>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
