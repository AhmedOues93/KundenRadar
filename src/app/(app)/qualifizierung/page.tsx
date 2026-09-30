import type { Metadata } from "next";
import { requireSessionContext } from "@/lib/auth";
import {
  loadLeadFacets,
  loadQualificationRows,
  type QualificationFilters as Filters,
} from "@/lib/queries";
import { QualificationFilters } from "@/components/qualification-filters";
import { QualificationList } from "@/components/qualification-list";
import { Card, CardBody, CardHeader, CardTitle, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Qualifizierung" };
export const dynamic = "force-dynamic";

type SearchParams = {
  score?: string;
  agency?: string;
  analysis?: string;
  industry?: string;
  city?: string;
  search?: string;
};

export default async function QualificationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSessionContext();
  const params = await searchParams;

  const filters: Filters = {
    score: params.score === "HIGH" ? "HIGH" : "ANY",
    agency: params.agency === "FOUND" || params.agency === "NONE" ? params.agency : "ANY",
    analysis:
      params.analysis === "MISSING" || params.analysis === "DONE" || params.analysis === "FAILED"
        ? params.analysis
        : "ANY",
    industry: params.industry?.trim() || undefined,
    city: params.city?.trim() || undefined,
    search: params.search?.trim() || undefined,
  };

  const [rows, facets] = await Promise.all([
    loadQualificationRows(session.organizationId, filters),
    loadLeadFacets(session.organizationId),
  ]);

  return (
    <>
      <PageHeader
        title="Qualifizierung"
        description="Analysierte Leads nach Analysepotenzial sortiert – höchstes zuerst."
        actions={
          <LinkButton href="/leads/discover" variant="primary">
            Neue Lead-Suche
          </LinkButton>
        }
      />

      <Card>
        <QualificationFilters
          values={{
            score: params.score ?? "ANY",
            agency: params.agency ?? "ANY",
            analysis: params.analysis ?? "ANY",
            industry: params.industry ?? "",
            city: params.city ?? "",
            search: params.search ?? "",
          }}
          cities={facets.cities}
          industries={facets.industries}
        />
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>
            {rows.length} {rows.length === 1 ? "Lead" : "Leads"}
          </CardTitle>
        </CardHeader>
        <CardBody>
          <QualificationList rows={rows} />
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Hinweis zur Einordnung</CardTitle>
        </CardHeader>
        <CardBody className="text-sm text-slate-600">
          <p>
            Der Score ist ein technischer Akquise-Potenzial-Wert: er beschreibt, wie interessant
            eine Website für eine manuelle Prüfung erscheint. Er sagt nicht aus, dass eine Firma
            Kunde werden wird. Ein Agenturhinweis bedeutet, dass auf der Website ein Hinweis auf
            eine Agentur gefunden wurde – nicht, dass ein aktuelles Vertragsverhältnis besteht.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
