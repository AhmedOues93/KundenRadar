import { NextResponse, type NextRequest } from "next/server";
import { requireSessionContext } from "@/lib/auth";
import { loadLeads, type LeadFilters } from "@/lib/queries";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from "@/lib/constants";
import { buildCsv, csvBoolean, csvDate, csvFilename, csvNumber } from "@/lib/csv";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * CSV-Export der Lead-Liste – mit genau den Filtern, die in der Oberfläche
 * gesetzt sind. Damit landet im Export das, was auf dem Bildschirm steht.
 */
export async function GET(request: NextRequest) {
  const session = await requireSessionContext();
  const params = request.nextUrl.searchParams;

  const filters: LeadFilters = {
    search: params.get("search")?.trim() || undefined,
    status: parseStatus(params.get("status")),
    city: params.get("city")?.trim() || undefined,
    industry: params.get("industry")?.trim() || undefined,
    sort: parseSort(params.get("sort")),
  };

  const leads = await loadLeads(session.organizationId, filters);

  const csv = buildCsv<Lead>(leads, [
    { header: "Firma", value: (lead) => lead.company_name },
    { header: "Website", value: (lead) => lead.website_url },
    { header: "Domain", value: (lead) => lead.domain },
    { header: "Strasse", value: (lead) => lead.street },
    { header: "PLZ", value: (lead) => lead.postal_code },
    { header: "Ort", value: (lead) => lead.city },
    { header: "Branche", value: (lead) => lead.industry },
    { header: "Ansprechpartner", value: (lead) => lead.contact_person },
    { header: "E-Mail", value: (lead) => lead.email },
    { header: "Telefon", value: (lead) => lead.phone },
    { header: "Status", value: (lead) => LEAD_STATUS_LABELS[lead.status] },
    { header: "Analysepotenzial", value: (lead) => csvNumber(lead.potential_score) },
    { header: "Agenturhinweis", value: (lead) => csvBoolean(lead.has_agency) },
    { header: "Erkannte Agentur", value: (lead) => lead.detected_agency_name },
    { header: "Quelle", value: (lead) => LEAD_SOURCE_LABELS[lead.source] },
    { header: "Letzte Analyse", value: (lead) => csvDate(lead.last_analyzed_at) },
    { header: "Angelegt am", value: (lead) => csvDate(lead.created_at) },
    { header: "Notiz", value: (lead) => lead.notes },
  ]);

  return csvResponse(csv, csvFilename("kundenradar-leads"));
}

function parseStatus(value: string | null): LeadFilters["status"] {
  if (!value) return "ACTIVE";
  if (value === "ALL" || value === "ACTIVE") return value;
  return (LEAD_STATUSES as readonly string[]).includes(value) ? (value as LeadStatus) : "ACTIVE";
}

function parseSort(value: string | null): LeadFilters["sort"] {
  return value === "created" || value === "company" ? value : "score";
}

export function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
