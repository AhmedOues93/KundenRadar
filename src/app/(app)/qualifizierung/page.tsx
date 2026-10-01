import type { Metadata } from "next";
import { requireSessionContext } from "@/lib/auth";
import {
  loadLeadFacets,
  loadQualificationRows,
  type QualificationFilters as Filters,
} from "@/lib/queries";
import { QualificationFilters } from "@/components/qualification-filters";
import { QualificationList } from "@/components/qualification-list";
import { LinkButton, PageHeader, Panel } from "@/components/ui";

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

  const exportParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) exportParams.set(key, value);
  }

  const offen = rows.filter((row) => !row.analysis && row.lead.website_url).length;

  return (
    <>
      <PageHeader
        title="Qualifizierung"
        meta={`${rows.length} ${rows.length === 1 ? "Lead" : "Leads"}${offen > 0 ? ` · ${offen} offen` : ""}`}
        description="Nach Analysepotenzial sortiert – höchstes zuerst. Der Wert ist ein technischer Akquise-Hinweis, keine Aussage über einen Abschluss."
        actions={
          <LinkButton href="/leads/discover" variant="primary">
            Neue Lead-Suche
          </LinkButton>
        }
      />

      <Panel>
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
          exportHref={`/api/export/qualifizierung?${exportParams.toString()}`}
        />
        <QualificationList rows={rows} />
      </Panel>
    </>
  );
}
