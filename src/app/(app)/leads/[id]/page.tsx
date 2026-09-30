import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSessionContext } from "@/lib/auth";
import { loadAnalyses, loadLead } from "@/lib/queries";
import { createServerSupabase } from "@/lib/supabase/server";
import { LEAD_SOURCE_LABELS } from "@/lib/constants";
import type { LeadActivity, LeadNote } from "@/lib/types";
import { AgencyBadge, AnalysisStatusBadge, LeadStatusBadge, ScoreBadge } from "@/components/badges";
import {
  AnalyzeButton,
  ArchiveButton,
  NoteForm,
  StatusChanger,
} from "@/components/lead-actions";
import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
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
  const lead = await loadLead(session.organizationId, id);
  return { title: lead?.company_name ?? "Lead" };
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSessionContext();
  const { id } = await params;

  const lead = await loadLead(session.organizationId, id);
  if (!lead) notFound();

  const supabase = await createServerSupabase();
  const [analyses, { data: notes }, { data: activities }] = await Promise.all([
    loadAnalyses(session.organizationId, { leadId: lead.id, limit: 10 }),
    supabase
      .from("lead_notes")
      .select("id, lead_id, body, created_by, created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("lead_activities")
      .select("id, lead_id, type, message, metadata, created_by, created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const latestAnalysis = analyses[0] ?? null;
  const contact = [
    { label: "Ansprechpartner", value: lead.contact_person },
    { label: "E-Mail", value: lead.email, href: lead.email ? `mailto:${lead.email}` : null },
    { label: "Telefon", value: lead.phone, href: lead.phone ? `tel:${lead.phone}` : null },
    { label: "Ort", value: [lead.postal_code, lead.city].filter(Boolean).join(" ") || null },
    { label: "Branche", value: lead.industry },
    { label: "Quelle", value: LEAD_SOURCE_LABELS[lead.source] },
  ];

  return (
    <>
      <PageHeader
        title={lead.company_name}
        description={
          lead.website_url
            ? displayUrl(lead.website_url, 60)
            : "Keine Website hinterlegt"
        }
        actions={
          <>
            <LinkButton href={`/leads/${lead.id}/bearbeiten`}>Bearbeiten</LinkButton>
            <LinkButton href="/leads" variant="ghost">
              Zurück
            </LinkButton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <LeadStatusBadge status={lead.status} />
        <ScoreBadge score={lead.potential_score} />
        <AgencyBadge hasAgency={lead.has_agency} name={lead.detected_agency_name} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Firma & Kontaktdaten</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="grid gap-3 sm:grid-cols-2">
                {contact.map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs font-medium text-slate-400">{item.label}</dt>
                    <dd className="text-sm text-slate-800">
                      {item.value ? (
                        item.href ? (
                          <a href={item.href} className="hover:underline">
                            {item.value}
                          </a>
                        ) : (
                          item.value
                        )
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </dd>
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-slate-400">Website</dt>
                  <dd className="text-sm">
                    {lead.website_url ? (
                      <a
                        href={lead.website_url}
                        target="_blank"
                        rel="noreferrer noopener nofollow"
                        className="text-slate-800 hover:underline"
                      >
                        {lead.website_url}
                      </a>
                    ) : (
                      <span className="text-slate-400">–</span>
                    )}
                  </dd>
                </div>
              </dl>

              {lead.notes ? (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium text-slate-400">Interne Notiz</p>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{lead.notes}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Website-Analyse</CardTitle>
              {latestAnalysis ? (
                <LinkButton href={`/analysen/${latestAnalysis.id}`} variant="ghost" size="sm">
                  Details ansehen
                </LinkButton>
              ) : null}
            </CardHeader>
            <CardBody className="space-y-3">
              <AnalyzeButton leadId={lead.id} websiteUrl={lead.website_url} />

              {latestAnalysis ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <AnalysisStatusBadge status={latestAnalysis.status} />
                    <ScoreBadge score={latestAnalysis.score} />
                    <span className="text-xs text-slate-500">
                      {formatDateTime(latestAnalysis.created_at)}
                    </span>
                  </div>
                  {latestAnalysis.error_message ? (
                    <p className="mt-2 text-sm text-rose-700">{latestAnalysis.error_message}</p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">
                      {countProblems(latestAnalysis.findings)} Probleme,{" "}
                      {countHints(latestAnalysis.findings)} Hinweise festgestellt.
                    </p>
                  )}
                  {latestAnalysis.agency_hint?.found ? (
                    <p className="mt-1.5 text-xs text-slate-500">
                      Agenturhinweis: {latestAnalysis.agency_hint.evidence ?? "gefunden"}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Für diesen Lead liegt noch keine Analyse vor.
                </p>
              )}

              {analyses.length > 1 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Frühere Analysen
                  </p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {analyses.slice(1).map((analysis) => (
                      <li key={analysis.id}>
                        <Link
                          href={`/analysen/${analysis.id}`}
                          className="text-slate-600 hover:underline"
                        >
                          {formatDateTime(analysis.created_at)} ·{" "}
                          {analysis.score !== null ? `${analysis.score}/100` : analysis.status}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notizen</CardTitle>
            </CardHeader>
            <CardBody>
              <NoteForm leadId={lead.id} />
            </CardBody>
            {(notes ?? []).length > 0 ? (
              <ul className="divide-y divide-slate-100 border-t border-slate-200">
                {((notes ?? []) as LeadNote[]).map((note) => (
                  <li key={note.id} className="px-4 py-3">
                    <p className="whitespace-pre-line text-sm text-slate-700">{note.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {formatDateTime(note.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Noch keine Notizen" />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline-Status</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <StatusChanger leadId={lead.id} status={lead.status} />
              <ArchiveButton leadId={lead.id} archived={lead.status === "ARCHIVED"} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agenturhinweis</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              <AgencyBadge hasAgency={lead.has_agency} name={lead.detected_agency_name} />
              {lead.has_agency ? (
                <Alert tone="info">
                  Auf der Website wurde ein Hinweis auf eine Webagentur gefunden. Das belegt nicht,
                  dass aktuell eine Zusammenarbeit besteht – bitte vor der Kontaktaufnahme manuell
                  prüfen.
                </Alert>
              ) : (
                <p className="text-slate-600">
                  In den geprüften Bereichen wurde kein Agenturhinweis gefunden. Ein fehlender
                  Hinweis ist kein Beweis dafür, dass keine Agentur betreut wird.
                </p>
              )}
              {latestAnalysis?.agency_hint?.sourceUrl ? (
                <p className="text-xs text-slate-500">
                  Quelle: {displayUrl(latestAnalysis.agency_hint.sourceUrl, 40)}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aktivitäten</CardTitle>
            </CardHeader>
            {(activities ?? []).length > 0 ? (
              <ol className="divide-y divide-slate-100">
                {((activities ?? []) as LeadActivity[]).map((activity) => (
                  <li key={activity.id} className="px-4 py-2.5">
                    <p className="text-sm text-slate-700">{activity.message}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatDateTime(activity.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Noch keine Aktivitäten" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function countProblems(findings: { severity: string }[] | null): number {
  return (findings ?? []).filter((finding) => finding.severity === "PROBLEM").length;
}

function countHints(findings: { severity: string }[] | null): number {
  return (findings ?? []).filter((finding) => finding.severity === "HINWEIS").length;
}
