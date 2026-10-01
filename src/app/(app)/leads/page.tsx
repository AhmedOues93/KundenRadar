import type { Metadata } from "next";
import { requireSessionContext } from "@/lib/auth";
import { loadLeadFacets, loadLeads, type LeadFilters as Filters } from "@/lib/queries";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/types";
import { LeadFilters } from "@/components/lead-filters";
import { LeadTable } from "@/components/lead-table";
import { LinkButton, PageHeader, Panel } from "@/components/ui";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

type SearchParams = {
  search?: string;
  status?: string;
  city?: string;
  industry?: string;
  sort?: string;
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSessionContext();
  const params = await searchParams;

  const sort = parseSort(params.sort);
  const filters: Filters = {
    search: params.search?.trim() || undefined,
    status: parseStatus(params.status),
    city: params.city?.trim() || undefined,
    industry: params.industry?.trim() || undefined,
    sort,
  };

  const [leads, facets] = await Promise.all([
    loadLeads(session.organizationId, filters),
    loadLeadFacets(session.organizationId),
  ]);

  const query = (overrides: Record<string, string>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({
      search: params.search ?? "",
      status: params.status ?? "",
      city: params.city ?? "",
      industry: params.industry ?? "",
      sort,
      ...overrides,
    })) {
      if (value) next.set(key, value);
    }
    return next.toString();
  };

  const withScore = leads.filter((lead) => lead.potential_score !== null).length;

  return (
    <>
      <PageHeader
        title="Leads"
        meta={`${leads.length} ${leads.length === 1 ? "Eintrag" : "Einträge"} · ${withScore} analysiert`}
        actions={
          <>
            <LinkButton href="/leads/discover">Lead-Suche</LinkButton>
            <LinkButton href="/leads/neu" variant="primary">
              Lead hinzufügen
            </LinkButton>
          </>
        }
      />

      <Panel>
        <LeadFilters
          values={{
            search: params.search ?? "",
            status: params.status ?? "ACTIVE",
            city: params.city ?? "",
            industry: params.industry ?? "",
            sort,
          }}
          cities={facets.cities}
          industries={facets.industries}
          exportHref={`/api/export/leads?${query({})}`}
        />
        <LeadTable
          leads={leads}
          sort={sort}
          hrefForSort={(key) => `/leads?${query({ sort: key })}`}
          emptyAction={<LinkButton href="/leads/neu">Lead hinzufügen</LinkButton>}
        />
      </Panel>
    </>
  );
}

function parseStatus(value: string | undefined): Filters["status"] {
  if (!value) return "ACTIVE";
  if (value === "ALL" || value === "ACTIVE") return value;
  return (LEAD_STATUSES as readonly string[]).includes(value) ? (value as LeadStatus) : "ACTIVE";
}

function parseSort(value: string | undefined): NonNullable<Filters["sort"]> {
  return value === "created" || value === "company" ? value : "score";
}
