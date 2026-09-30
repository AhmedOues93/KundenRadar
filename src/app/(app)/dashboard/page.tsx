import type { Metadata } from "next";
import { requireSessionContext } from "@/lib/auth";
import { loadDashboardStats, loadRecentLeads } from "@/lib/queries";
import { KpiCard } from "@/components/kpi-card";
import { LeadTable } from "@/components/lead-table";
import { Card, CardBody, CardHeader, CardTitle, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSessionContext();
  const [stats, recentLeads] = await Promise.all([
    loadDashboardStats(session.organizationId),
    loadRecentLeads(session.organizationId),
  ]);

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
            <LinkButton href="/leads/neu" variant="primary">
              Lead hinzufügen
            </LinkButton>
            <LinkButton href="/analysen/neu">Website analysieren</LinkButton>
          </>
        }
      />

      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

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
