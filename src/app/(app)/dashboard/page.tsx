import type { Metadata } from "next";
import { requireSessionContext } from "@/lib/auth";
import { loadDashboardStats, loadDiscoveryStats, loadRecentLeads } from "@/lib/queries";
import { loadDiscoveryRuns } from "@/lib/discovery/queries";
import { DISCOVERY_RUN_STATUS_LABELS } from "@/lib/discovery/labels";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { KpiCard } from "@/components/kpi-card";
import { LeadTable } from "@/components/lead-table";
import { Card, CardBody, CardHeader, CardTitle, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSessionContext();
  const [stats, discovery, recentLeads, runs] = await Promise.all([
    loadDashboardStats(session.organizationId),
    loadDiscoveryStats(session.organizationId),
    loadRecentLeads(session.organizationId),
    loadDiscoveryRuns(session.organizationId, 3),
  ]);

  const lastRun = runs[0] ?? null;

  const kpis = [
    {
      label: "Gefundene Leads",
      value: stats.totalLeads,
      href: "/leads?status=ALL",
      hint: "Alle erfassten Firmen",
    },
    {
      label: "Analysierte Websites",
      value: stats.analyzedWebsites,
      href: "/analysen",
      hint: "Erfolgreiche Analysen",
    },
    {
      label: "Interessante Leads",
      value: stats.interestingLeads,
      hint: "Analysepotenzial ab 60",
      accent: "text-orange-700",
    },
    {
      label: "Zu kontaktieren",
      value: stats.byStatus.TO_CONTACT,
      href: "/leads?status=TO_CONTACT",
    },
    { label: "Kontaktierte Leads", value: stats.byStatus.CONTACTED, href: "/leads?status=CONTACTED" },
    { label: "Termine", value: stats.byStatus.MEETING, href: "/leads?status=MEETING" },
    { label: "Angebote", value: stats.byStatus.OFFER, href: "/leads?status=OFFER" },
    {
      label: "Gewonnene Kunden",
      value: stats.byStatus.WON,
      href: "/leads?status=WON",
      accent: "text-emerald-700",
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Akquise-Überblick für ${session.organizationName}.`}
        actions={
          <>
            <LinkButton href="/leads/discover" variant="primary">
              Lead-Suche starten
            </LinkButton>
            <LinkButton href="/leads/neu">Lead hinzufügen</LinkButton>
          </>
        }
      />

      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <section
        aria-label="Kennzahlen zur Lead-Suche"
        className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4"
      >
        <KpiCard
          label="Neu gefundene Leads"
          value={discovery.fromDiscovery}
          hint="Aus automatischer Suche"
          href="/leads?status=ALL"
        />
        <KpiCard
          label="Noch nicht analysiert"
          value={discovery.notAnalyzed}
          href="/qualifizierung?analysis=MISSING"
        />
        <KpiCard
          label="Hohe Potenziale"
          value={discovery.highPotential}
          hint="Analysepotenzial ab 60"
          href="/qualifizierung?score=HIGH"
          accent="text-orange-700"
        />
        <KpiCard
          label="Agenturhinweise"
          value={discovery.agencyHints}
          href="/qualifizierung?agency=FOUND"
        />
      </section>

      {lastRun ? (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Letzte Lead-Suche</CardTitle>
            <LinkButton href="/leads/discover" variant="ghost" size="sm">
              Zur Lead-Suche
            </LinkButton>
          </CardHeader>
          <CardBody className="text-sm text-slate-600">
            <p>
              <Link href={`/leads/discover?run=${lastRun.id}`} className="font-medium text-slate-900 hover:underline">
                {lastRun.industry_label ?? lastRun.industry} · {lastRun.resolved_place ?? lastRun.city}
              </Link>{" "}
              <span className="text-slate-400">({lastRun.radius_km} km)</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatDateTime(lastRun.created_at)} · {DISCOVERY_RUN_STATUS_LABELS[lastRun.status]}
              {lastRun.status === "SUCCESS"
                ? ` · ${lastRun.result_count} Treffer, ${lastRun.new_count} neu, ${lastRun.imported_count} importiert`
                : ""}
            </p>
            {lastRun.status === "FAILED" && lastRun.error_message ? (
              <p className="mt-1 text-xs text-rose-700">{lastRun.error_message}</p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Neueste Leads</CardTitle>
          <LinkButton href="/leads" variant="ghost" size="sm">
            Alle Leads
          </LinkButton>
        </CardHeader>
        <LeadTable leads={recentLeads} />
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Hinweis zur Bewertung</CardTitle>
        </CardHeader>
        <CardBody className="text-sm text-slate-600">
          <p>
            Das ausgewiesene Analysepotenzial beschreibt, wie interessant eine Website für eine
            manuelle Akquise-Prüfung erscheint. Es ist keine Aussage darüber, ob eine Firma Kunde
            wird. Ein Agenturhinweis bedeutet, dass auf der Website ein Hinweis auf eine Agentur
            gefunden wurde – nicht, dass aktuell eine Zusammenarbeit besteht.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
