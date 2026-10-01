import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSessionContext } from "@/lib/auth";
import { loadAnalyses, loadLead } from "@/lib/queries";
import { createServerSupabase } from "@/lib/supabase/server";
import { LEAD_SOURCE_LABELS } from "@/lib/constants";
import { buildHistory } from "@/lib/analysis-history";
import { loadLeadSource } from "@/lib/discovery/queries";
import { providerLabel } from "@/lib/discovery/labels";
import type { LeadActivity, LeadNote } from "@/lib/types";
import { AgencyBadge, LeadStatusBadge, ScoreBadge } from "@/components/badges";
import { AnalysisHistoryPanel } from "@/components/analysis-history";
import { AnalyzeButton, ArchiveButton, NoteForm, StatusChanger } from "@/components/lead-actions";
import {
  Alert,
  Blank,
  DescriptionList,
  DescriptionRow,
  EmptyState,
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
  const lead = await loadLead(session.organizationId, id);
  return { title: lead?.company_name ?? "Lead" };
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionContext();
  const { id } = await params;

  const lead = await loadLead(session.organizationId, id);
  if (!lead) notFound();

  const supabase = await createServerSupabase();
  const [analyses, leadSource, { data: notes }, { data: activities }] = await Promise.all([
    loadAnalyses(session.organizationId, { leadId: lead.id, limit: 50 }),
    loadLeadSource(session.organizationId, lead.id),
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
      .limit(40),
  ]);

  const history = buildHistory(analyses);
  const letzte = analyses[0] ?? null;

  return (
    <>
      <PageHeader
        title={lead.company_name}
        meta={
          lead.website_url ? (
            <a
              href={lead.website_url}
              target="_blank"
              rel="noreferrer noopener nofollow"
              className="hover:text-blue-700 hover:underline"
            >
              {displayUrl(lead.website_url, 50)}
            </a>
          ) : (
            "Keine Website hinterlegt"
          )
        }
        actions={
          <>
            <LinkButton href="/leads" variant="ghost">
              Zurück
            </LinkButton>
            <LinkButton href={`/leads/${lead.id}/bearbeiten`}>Bearbeiten</LinkButton>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <LeadStatusBadge status={lead.status} />
        <ScoreBadge score={lead.potential_score} />
        <AgencyBadge hasAgency={lead.has_agency} name={lead.detected_agency_name} />
        {lead.source === "DISCOVERY" ? (
          <span className="text-[11px] text-slate-400">
            Gefunden über {leadSource ? providerLabel(leadSource.provider) : "automatische Suche"}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]">
        {/* Hauptspalte */}
        <div className="min-w-0 space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>Firma</PanelTitle>
              </PanelHeader>
              <DescriptionList>
                <DescriptionRow label="Ansprechpartner">
                  {lead.contact_person ?? <Blank />}
                </DescriptionRow>
                <DescriptionRow label="E-Mail">
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} className="hover:text-blue-700 hover:underline">
                      {lead.email}
                    </a>
                  ) : (
                    <Blank />
                  )}
                </DescriptionRow>
                <DescriptionRow label="Telefon">
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="hover:text-blue-700 hover:underline">
                      {lead.phone}
                    </a>
                  ) : (
                    <Blank />
                  )}
                </DescriptionRow>
                <DescriptionRow label="Adresse">
                  {[lead.street, [lead.postal_code, lead.city].filter(Boolean).join(" ")]
                    .filter(Boolean)
                    .join(", ") || <Blank />}
                </DescriptionRow>
                <DescriptionRow label="Branche">{lead.industry ?? <Blank />}</DescriptionRow>
                <DescriptionRow label="Quelle">{LEAD_SOURCE_LABELS[lead.source]}</DescriptionRow>
                {leadSource?.source_url ? (
                  <DescriptionRow label="Quelldatensatz">
                    <a
                      href={leadSource.source_url}
                      target="_blank"
                      rel="noreferrer noopener nofollow"
                      className="hover:text-blue-700 hover:underline"
                    >
                      {leadSource.external_id}
                    </a>
                  </DescriptionRow>
                ) : null}
                <DescriptionRow label="Angelegt">{formatDateTime(lead.created_at)}</DescriptionRow>
              </DescriptionList>
              {lead.notes ? (
                <PanelBody className="border-t border-[var(--kr-line)]">
                  <p className="mb-0.5 text-[11px] text-slate-500">Interne Notiz</p>
                  <p className="whitespace-pre-line text-[13px] text-slate-700">{lead.notes}</p>
                </PanelBody>
              ) : null}
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitle>Analyse-Verlauf</PanelTitle>
                {letzte ? (
                  <Link
                    href={`/analysen/${letzte.id}`}
                    className="text-[11px] text-slate-500 hover:text-slate-900 hover:underline"
                  >
                    Letzte Analyse ansehen
                  </Link>
                ) : null}
              </PanelHeader>
              <AnalysisHistoryPanel history={history} leadId={lead.id} />
            </Panel>
          </div>

          <Panel>
            <PanelHeader>
              <PanelTitle>Notizen</PanelTitle>
              <span className="text-[11px] text-slate-400">{(notes ?? []).length}</span>
            </PanelHeader>
            <PanelBody>
              <NoteForm leadId={lead.id} />
            </PanelBody>
            {(notes ?? []).length > 0 ? (
              <ul className="divide-y divide-[var(--kr-line)] border-t border-[var(--kr-line)]">
                {((notes ?? []) as LeadNote[]).map((note) => (
                  <li key={note.id} className="px-3 py-1.5">
                    <p className="whitespace-pre-line text-[13px] text-slate-700">{note.body}</p>
                    <p className="mt-0.5 text-[10.5px] text-slate-400">
                      {formatDateTime(note.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>
        </div>

        {/* Seitenspalte */}
        <div className="space-y-3">
          <Panel>
            <PanelHeader>
              <PanelTitle>Aktionen</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-2.5">
              <AnalyzeButton leadId={lead.id} websiteUrl={lead.website_url} />
              <div>
                <p className="mb-1 text-[11px] text-slate-500">Pipeline-Status</p>
                <StatusChanger leadId={lead.id} status={lead.status} />
              </div>
              <div className="border-t border-[var(--kr-line)] pt-2">
                <ArchiveButton leadId={lead.id} archived={lead.status === "ARCHIVED"} />
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Agenturhinweis</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-1.5 text-[12.5px]">
              {lead.has_agency ? (
                <>
                  <p className="font-medium text-slate-800">
                    {lead.detected_agency_name
                      ? `Hinweis gefunden: ${lead.detected_agency_name}`
                      : "Hinweis gefunden"}
                  </p>
                  {letzte?.agency_hint?.evidence ? (
                    <p className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600">
                      {letzte.agency_hint.evidence}
                    </p>
                  ) : null}
                  {letzte?.agency_hint?.location ? (
                    <p className="text-[11px] text-slate-500">
                      Fundstelle: {letzte.agency_hint.location}
                    </p>
                  ) : null}
                  <Alert tone="info">
                    Das belegt nicht, dass aktuell eine Zusammenarbeit besteht – vor der
                    Kontaktaufnahme manuell prüfen.
                  </Alert>
                </>
              ) : (
                <p className="text-slate-600">
                  In den geprüften Bereichen wurde kein Agenturhinweis gefunden. Das ist kein
                  Beweis dafür, dass keine Agentur betreut wird.
                </p>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Aktivitäten</PanelTitle>
            </PanelHeader>
            {(activities ?? []).length > 0 ? (
              <ol className="divide-y divide-[var(--kr-line)]">
                {((activities ?? []) as LeadActivity[]).map((activity) => (
                  <li key={activity.id} className="px-3 py-1.5">
                    <p className="text-[12.5px] text-slate-700">{activity.message}</p>
                    <p className="text-[10.5px] text-slate-400">
                      {formatDateTime(activity.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState compact title="Noch keine Aktivitäten" />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
