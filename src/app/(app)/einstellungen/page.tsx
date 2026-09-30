import type { Metadata } from "next";
import { hasAdminRights, requireSessionContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { ORGANIZATION_ROLE_LABELS, SCORE_BANDS } from "@/lib/constants";
import { LIMITS } from "@/lib/analysis/fetcher";
import { SCORE_WEIGHTS } from "@/lib/analysis/score";
import type { OrganizationRole } from "@/lib/types";
import { Badge, Card, CardBody, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Einstellungen" };
export const dynamic = "force-dynamic";

type MemberRow = {
  user_id: string;
  role: OrganizationRole;
  created_at: string;
  profiles: { email: string | null; full_name: string | null } | null;
};

export default async function SettingsPage() {
  const session = await requireSessionContext();
  const supabase = await createServerSupabase();

  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, role, created_at, profiles(email, full_name)")
    .eq("organization_id", session.organizationId)
    .order("created_at", { ascending: true });

  const memberRows = ((members ?? []) as unknown[]).map((row) => {
    const record = row as MemberRow & { profiles: MemberRow["profiles"] | MemberRow["profiles"][] };
    const profile = Array.isArray(record.profiles) ? record.profiles[0] : record.profiles;
    return { ...record, profile: profile ?? null };
  });

  return (
    <>
      <PageHeader
        title="Einstellungen"
        description="Organisation, Team und Grundlagen der Bewertung."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organisation</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-800">{session.organizationName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Deine Rolle</dt>
                <dd className="font-medium text-slate-800">
                  {ORGANIZATION_ROLE_LABELS[session.role]}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Angemeldet als</dt>
                <dd className="font-medium text-slate-800">{session.email ?? "–"}</dd>
              </div>
            </dl>
            {!hasAdminRights(session.role) ? (
              <p className="mt-3 text-xs text-slate-500">
                Änderungen an der Organisation sind Inhabern und Administratoren vorbehalten.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <span className="text-xs text-slate-500">{memberRows.length} Mitglieder</span>
          </CardHeader>
          <ul className="divide-y divide-slate-100">
            {memberRows.map((member) => (
              <li
                key={member.user_id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {member.profile?.full_name ?? member.profile?.email ?? "Unbekannt"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Seit {formatDate(member.created_at)}
                  </p>
                </div>
                <Badge>{ORGANIZATION_ROLE_LABELS[member.role]}</Badge>
              </li>
            ))}
          </ul>
          <CardBody className="border-t border-slate-100 text-xs text-slate-500">
            Weitere Mitglieder werden in Phase 1 direkt in Supabase eingeladen. Die Rollen OWNER,
            ADMIN und MEMBER sind im Datenmodell und in den RLS-Policies bereits vorgesehen.
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bewertungsbänder</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-1.5 text-sm">
              {SCORE_BANDS.map((band) => (
                <li key={band.label} className="flex items-center justify-between gap-3">
                  <span className="tabular-nums text-slate-500">
                    {band.min}–{band.max}
                  </span>
                  <Badge tone={band.tone}>{band.label}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Der Wert beschreibt das Analysepotenzial einer Website für eine manuelle
              Akquise-Prüfung. Er ist keine Prognose über einen Vertragsabschluss.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Grenzen der Website-Analyse</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="space-y-2 text-sm">
              <Row label="Timeout pro Anfrage" value={`${LIMITS.requestTimeoutMs / 1000} s`} />
              <Row label="Gesamtbudget" value={`${LIMITS.totalTimeoutMs / 1000} s`} />
              <Row label="Weiterleitungen" value={`max. ${LIMITS.maxRedirects}`} />
              <Row
                label="Gelesenes HTML"
                value={`max. ${Math.round(LIMITS.maxHtmlBytes / 1024)} kB`}
              />
              <Row label="Geprüfte Links" value={`max. ${LIMITS.maxLinkChecks}`} />
              <Row label="Geprüfte Bilder" value={`max. ${LIMITS.maxImageChecks}`} />
              <Row
                label="Grenze „grosses Bild“"
                value={`${Math.round(LIMITS.largeImageBytes / 1024)} kB`}
              />
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              Es wird keine vollständige Domain durchsucht. Adressen in privaten, lokalen oder
              reservierten Netzen werden abgewiesen – auch nach einer Weiterleitung.
            </p>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Punktvergabe der Bewertung</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="mb-3 text-sm text-slate-600">
              Alle Punkte entstehen aus festen Regeln. Es kommt keine AI und kein Zufall zum
              Einsatz.
            </p>
            <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {SCORE_WEIGHT_LABELS.map(([key, label]) => (
                <Row key={key} label={label} value={`+${SCORE_WEIGHTS[key]}`} />
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

const SCORE_WEIGHT_LABELS: [keyof typeof SCORE_WEIGHTS, string][] = [
  ["httpError", "Startseite antwortet mit Fehlerstatus"],
  ["noHttps", "Kein HTTPS"],
  ["slowResponse", "Antwortzeit über 2,5 s"],
  ["moderateResponse", "Antwortzeit über 1,2 s"],
  ["manyRedirects", "Mehr als zwei Weiterleitungen"],
  ["titleMissing", "Seitentitel fehlt"],
  ["titleWeak", "Seitentitel auffällig kurz oder lang"],
  ["descriptionMissing", "Meta-Description fehlt"],
  ["descriptionWeak", "Meta-Description auffällig lang oder kurz"],
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
  ["brokenLinkMax", "Obergrenze nicht erreichbare Links"],
  ["missingAltMax", "Obergrenze Bilder ohne Alt-Text"],
  ["largeImageEach", "Je auffällig grosses Bild"],
  ["largeImageMax", "Obergrenze grosse Bilder"],
  ["thinContent", "Sehr wenig Seiteninhalt"],
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="shrink-0 font-medium tabular-nums text-slate-800">{value}</dd>
    </div>
  );
}
