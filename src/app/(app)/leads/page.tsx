import type { Metadata } from "next";
import { requireSessionContext } from "@/lib/auth";
import { loadLeadFacets, loadLeads, type LeadFilters as Filters } from "@/lib/queries";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/types";
import { LeadFilters } from "@/components/lead-filters";
import { LeadTable } from "@/components/lead-table";
import { Card, CardHeader, CardTitle, LinkButton, PageHeader } from "@/components/ui";

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

  const filters: Filters = {
    search: params.search?.trim() || undefined,
    status: parseStatus(params.status),
    city: params.city?.trim() || undefined,
    industry: params.industry?.trim() || undefined,
    sort: parseSort(params.sort),
  };

  const [leads, facets] = await Promise.all([
    loadLeads(session.organizationId, filters),
    loadLeadFacets(session.organizationId),
  ]);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Potenzielle Neukunden erfassen, qualifizieren und weiterverfolgen."
        actions={<LinkButton href="/leads/neu" variant="primary">Lead hinzufügen</LinkButton>}
      />

      <Card>
        <LeadFilters
          values={{
            search: params.search ?? "",
            status: params.status ?? "ACTIVE",
            city: params.city ?? "",
            industry: params.industry ?? "",
            sort: params.sort ?? "score",
          }}
          cities={facets.cities}
          industries={facets.industries}
        />
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>
            {leads.length} {leads.length === 1 ? "Lead" : "Leads"}
          </CardTitle>
        </CardHeader>
        <LeadTable leads={leads} />
      </Card>
    </>
  );
}

function parseStatus(value: string | undefined): Filters["status"] {
  if (!value) return "ACTIVE";
  if (value === "ALL" || value === "ACTIVE") return value;
  return (LEAD_STATUSES as readonly string[]).includes(value)
    ? (value as LeadStatus)
    : "ACTIVE";
}

function parseSort(value: string | undefined): Filters["sort"] {
  return value === "created" || value === "company" ? value : "score";
}
