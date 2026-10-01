import type { Metadata } from "next";
import { hasAdminRights, requireSessionContext } from "@/lib/auth";
import { loadInvitations, loadMembers } from "@/lib/team/queries";
import { ORGANIZATION_ROLE_LABELS, SCORE_BANDS } from "@/lib/constants";
import { LIMITS } from "@/lib/analysis/fetcher";
import { SCORE_WEIGHTS } from "@/lib/analysis/score";
import { BATCH_DEFAULTS } from "@/lib/analysis/batch-limits";
import { INVITATION_TTL_DAYS } from "@/lib/team/tokens";
import {
  InvitationTable,
  InviteForm,
  MemberTable,
} from "@/components/team-management";
import {
  Badge,
  DescriptionList,
  DescriptionRow,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from "@/components/ui";

export const metadata: Metadata = { title: "Einstellungen" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSessionContext();
  const canManage = hasAdminRights(session.role);

  const [members, invitations] = await Promise.all([
    loadMembers(session.organizationId, session.userId),
    canManage ? loadInvitations(session.organizationId) : Promise.resolve([]),
  ]);

  const offeneEinladungen = invitations.filter((entry) => entry.status === "PENDING").length;

  return (
    <>
      <PageHeader
        title="Einstellungen"
        meta={`${members.length} ${members.length === 1 ? "Mitglied" : "Mitglieder"}${offeneEinladungen > 0 ? ` · ${offeneEinladungen} offene Einladungen` : ""}`}
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          <Panel>
            <PanelHeader>
              <PanelTitle>Team</PanelTitle>
              <span className="text-[11px] text-slate-400">
                {canManage ? "Du kannst Rollen ändern und Mitglieder entfernen." : "Nur Ansicht"}
              </span>
            </PanelHeader>
            <MemberTable members={members} canManage={canManage} ownRole={session.role} />
          </Panel>

          {canManage ? (
            <>
              <Panel>
                <PanelHeader>
                  <PanelTitle>Mitglied einladen</PanelTitle>
                </PanelHeader>
                <PanelBody>
                  <InviteForm />
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader>
                  <PanelTitle>Einladungen</PanelTitle>
                  <span className="text-[11px] text-slate-400">
                    Gültigkeit {INVITATION_TTL_DAYS} Tage
                  </span>
                </PanelHeader>
                <InvitationTable invitations={invitations} />
              </Panel>
            </>
          ) : (
            <Panel>
              <PanelBody className="text-[12.5px] text-slate-600">
                Einladungen und Rollen verwalten Inhaber und Administratoren.
              </PanelBody>
            </Panel>
          )}

          <Panel>
            <PanelHeader>
              <PanelTitle>Punktvergabe der Bewertung</PanelTitle>
              <span className="text-[11px] text-slate-400">
                feste Regeln, keine AI, kein Zufall
              </span>
            </PanelHeader>
            <PanelBody>
              <dl className="grid gap-x-6 gap-y-0.5 text-[12.5px] sm:grid-cols-2 lg:grid-cols-3">
                {SCORE_WEIGHT_LABELS.map(([key, label]) => (
                  <div key={key} className="flex items-baseline justify-between gap-2 border-b border-[var(--kr-line)] py-1">
                    <dt className="truncate text-slate-600">{label}</dt>
                    <dd className="tabnum shrink-0 font-medium text-slate-900">
                      +{SCORE_WEIGHTS[key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </PanelBody>
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel>
            <PanelHeader>
              <PanelTitle>Organisation</PanelTitle>
            </PanelHeader>
            <DescriptionList>
              <DescriptionRow label="Name">{session.organizationName}</DescriptionRow>
              <DescriptionRow label="Deine Rolle">
                {ORGANIZATION_ROLE_LABELS[session.role]}
              </DescriptionRow>
              <DescriptionRow label="Angemeldet als">{session.email ?? "–"}</DescriptionRow>
            </DescriptionList>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Bewertungsbänder</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-1">
              {SCORE_BANDS.map((band) => (
                <div key={band.label} className="flex items-center justify-between gap-2">
                  <span className="tabnum text-[12px] text-slate-500">
                    {band.min}–{band.max}
                  </span>
                  <Badge tone={band.tone}>{band.label}</Badge>
                </div>
              ))}
              <p className="pt-1 text-[11px] leading-relaxed text-slate-500">
                Der Wert beschreibt das Analysepotenzial einer Website für eine manuelle
                Akquise-Prüfung – keine Prognose über einen Abschluss.
              </p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Grenzen der Analyse</PanelTitle>
            </PanelHeader>
            <DescriptionList className="text-[12.5px]">
              <DescriptionRow label="Timeout/Anfrage">
                {LIMITS.requestTimeoutMs / 1000} s
              </DescriptionRow>
              <DescriptionRow label="Gesamtbudget">{LIMITS.totalTimeoutMs / 1000} s</DescriptionRow>
              <DescriptionRow label="Weiterleitungen">max. {LIMITS.maxRedirects}</DescriptionRow>
              <DescriptionRow label="Gelesenes HTML">
                max. {(LIMITS.maxHtmlBytes / 1_000_000).toLocaleString("de-DE")} MB
              </DescriptionRow>
              <DescriptionRow label="Geprüfte Links">max. {LIMITS.maxLinkChecks}</DescriptionRow>
              <DescriptionRow label="Geprüfte Bilder">max. {LIMITS.maxImageChecks}</DescriptionRow>
              <DescriptionRow label="Stapel-Analyse">
                {BATCH_DEFAULTS.concurrency} gleichzeitig, max. {BATCH_DEFAULTS.maxItems} je Lauf
              </DescriptionRow>
            </DescriptionList>
            <PanelBody className="border-t border-[var(--kr-line)] text-[11px] leading-relaxed text-slate-500">
              Es wird keine vollständige Domain durchsucht. Adressen in privaten, lokalen oder
              reservierten Netzen werden abgewiesen – auch nach einer Weiterleitung.
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}

const SCORE_WEIGHT_LABELS: [keyof typeof SCORE_WEIGHTS, string][] = [
  ["httpError", "Fehlerstatus der Startseite"],
  ["noHttps", "Kein HTTPS"],
  ["slowResponse", "Antwortzeit über 2,5 s"],
  ["moderateResponse", "Antwortzeit über 1,2 s"],
  ["manyRedirects", "Mehr als zwei Weiterleitungen"],
  ["titleMissing", "Seitentitel fehlt"],
  ["titleWeak", "Titel auffällig kurz/lang"],
  ["descriptionMissing", "Meta-Description fehlt"],
  ["descriptionWeak", "Description auffällig lang/kurz"],
  ["h1Missing", "H1-Überschrift fehlt"],
  ["h1Multiple", "Mehrere H1-Überschriften"],
  ["viewportMissing", "Viewport-Meta-Tag fehlt"],
  ["canonicalMissing", "Canonical fehlt"],
  ["robotsMissing", "robots.txt fehlt"],
  ["sitemapMissing", "sitemap.xml fehlt"],
  ["openGraphMissing", "Open-Graph-Daten fehlen"],
  ["structuredDataMissing", "Strukturierte Daten fehlen"],
  ["langMissing", "Sprachangabe fehlt"],
  ["brokenLinkEach", "Je nicht erreichbarer Link"],
  ["brokenLinkMax", "Obergrenze defekte Links"],
  ["missingAltMax", "Obergrenze Bilder ohne Alt-Text"],
  ["largeImageEach", "Je grosses Bild"],
  ["largeImageMax", "Obergrenze grosse Bilder"],
  ["thinContent", "Sehr wenig Seiteninhalt"],
];
