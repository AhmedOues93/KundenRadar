import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSessionContext } from "@/lib/auth";
import { loadAnalysis, loadLead } from "@/lib/queries";
import { AnalysisStatusBadge } from "@/components/badges";
import { FindingGroups, ScoreSummary } from "@/components/findings";
import {
  Alert,
  DescriptionList,
  DescriptionRow,
  LinkButton,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
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

  const lead = analysis.lead_id ? await loadLead(session.organizationId, analysis.lead_id) : null;
  const metrics = analysis.metrics;

  return (
    <>
      <PageHeader
        title={analysis.domain ?? displayUrl(analysis.requested_url, 50)}
        meta={formatDateTime(analysis.created_at)}
        actions={
          <>
            <LinkButton href="/analysen" variant="ghost">
              Zurück
            </LinkButton>
            {lead ? <LinkButton href={`/leads/${lead.id}`}>Zum Lead</LinkButton> : null}
            {analysis.final_url ? (
              <a
                href={analysis.final_url}
                target="_blank"
                rel="noreferrer noopener nofollow"
                className="inline-flex h-8 items-center rounded border border-[var(--kr-line-strong)] bg-white px-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
              >
                Website öffnen
              </a>
            ) : null}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AnalysisStatusBadge status={analysis.status} />
        {analysis.final_url ? (
          <span className="truncate text-[12px] text-slate-500">{analysis.final_url}</span>
        ) : null}
        {lead ? (
          <Link
            href={`/leads/${lead.id}`}
            className="text-[12px] text-slate-500 hover:text-blue-700 hover:underline"
          >
            {lead.company_name}
          </Link>
        ) : null}
      </div>

      {analysis.status !== "SUCCESS" ? (
        <Alert
          tone={analysis.status === "BLOCKED" ? "warning" : "error"}
          title={analysis.status === "BLOCKED" ? "Analyse abgelehnt" : "Analyse fehlgeschlagen"}
        >
          {analysis.error_message ?? "Es liegen keine weiteren Angaben vor."}
        </Alert>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="min-w-0">
            <FindingGroups findings={analysis.findings ?? []} />
          </div>

          <div className="space-y-3">
            <ScoreSummary score={analysis.score} findings={analysis.findings ?? []} />

            {analysis.agency_hint ? (
              <Panel>
                <PanelHeader>
                  <PanelTitle>Agenturhinweis</PanelTitle>
                </PanelHeader>
                <PanelBody className="space-y-1.5 text-[12.5px]">
                  {analysis.agency_hint.found ? (
                    <>
                      <p className="font-medium text-slate-800">
                        {analysis.agency_hint.agencyName
                          ? `Gefunden: ${analysis.agency_hint.agencyName}`
                          : "Hinweis gefunden"}
                      </p>
                      {analysis.agency_hint.evidence ? (
                        <p className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600">
                          {analysis.agency_hint.evidence}
                        </p>
                      ) : null}
                      {analysis.agency_hint.location ? (
                        <p className="text-[11px] text-slate-500">
                          Fundstelle: {analysis.agency_hint.location}
                        </p>
                      ) : null}
                      <Alert tone="info">
                        Ein gefundener Hinweis belegt nicht, dass aktuell eine Zusammenarbeit mit
                        dieser Agentur besteht.
                      </Alert>
                    </>
                  ) : (
                    <p className="text-slate-600">
                      Kein Agenturhinweis gefunden. Das ist kein Beweis dafür, dass keine Agentur
                      betreut wird.
                    </p>
                  )}
                </PanelBody>
              </Panel>
            ) : null}

            {metrics ? (
              <Panel>
                <PanelHeader>
                  <PanelTitle>Messwerte</PanelTitle>
                </PanelHeader>
                <DescriptionList className="text-[12.5px]">
                  <DescriptionRow label="HTTP-Status">{metrics.httpStatus ?? "–"}</DescriptionRow>
                  <DescriptionRow label="HTTPS">{metrics.https ? "ja" : "nein"}</DescriptionRow>
                  <DescriptionRow label="Weiterleitungen">{metrics.redirectCount}</DescriptionRow>
                  <DescriptionRow label="Antwortzeit">
                    {metrics.responseTimeMs !== null ? `${metrics.responseTimeMs} ms` : "–"}
                  </DescriptionRow>
                  <DescriptionRow label="Sprache">{metrics.langAttribute ?? "fehlt"}</DescriptionRow>
                  <DescriptionRow label="Canonical">
                    {metrics.canonical ? "vorhanden" : "fehlt"}
                  </DescriptionRow>
                  <DescriptionRow label="robots.txt">
                    {metrics.robotsTxt ? "vorhanden" : "fehlt"}
                  </DescriptionRow>
                  <DescriptionRow label="sitemap.xml">
                    {metrics.sitemapXml ? "vorhanden" : "fehlt"}
                  </DescriptionRow>
                  <DescriptionRow label="Strukt. Daten">
                    {metrics.structuredData ? "vorhanden" : "fehlen"}
                  </DescriptionRow>
                  <DescriptionRow label="Links">
                    {metrics.internalLinks} intern / {metrics.externalLinks} extern
                  </DescriptionRow>
                  <DescriptionRow label="Geprüfte Links">
                    {metrics.checkedLinks} ({metrics.brokenLinks.length} defekt)
                  </DescriptionRow>
                  <DescriptionRow label="Bilder">
                    {metrics.imageCount} ({metrics.imagesWithoutAlt} ohne Alt-Text)
                  </DescriptionRow>
                  <DescriptionRow label="HTML-Grösse">
                    {Math.max(1, Math.round(metrics.htmlBytes / 1024))} kB
                  </DescriptionRow>
                  {metrics.cmsHints.length > 0 ? (
                    <DescriptionRow label="System">{metrics.cmsHints.join(", ")}</DescriptionRow>
                  ) : null}
                </DescriptionList>

                {metrics.redirectChain.length > 1 || metrics.brokenLinks.length > 0 ? (
                  <PanelBody className="space-y-2 border-t border-[var(--kr-line)]">
                    {metrics.redirectChain.length > 1 ? (
                      <div>
                        <p className="text-[11px] text-slate-500">Weiterleitungskette</p>
                        <ol className="mt-0.5 space-y-px text-[11px] text-slate-600">
                          {metrics.redirectChain.map((url, index) => (
                            <li key={`${url}-${index}`} className="break-all">
                              {index + 1}. {url}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    {metrics.brokenLinks.length > 0 ? (
                      <div>
                        <p className="text-[11px] text-slate-500">
                          Nicht erreichbare Links (Stichprobe)
                        </p>
                        <ul className="mt-0.5 space-y-px text-[11px] text-slate-600">
                          {metrics.brokenLinks.map((link) => (
                            <li key={link.url} className="break-all">
                              {link.url} {link.status ? `(${link.status})` : "(keine Antwort)"}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </PanelBody>
                ) : null}
              </Panel>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
