import { type NextRequest } from "next/server";
import { requireSessionContext } from "@/lib/auth";
import { loadQualificationRows, type QualificationFilters, type QualificationRow } from "@/lib/queries";
import { LEAD_STATUS_LABELS, ANALYSIS_STATUS_LABELS } from "@/lib/constants";
import { buildCsv, csvBoolean, csvDate, csvFilename, csvNumber } from "@/lib/csv";
import { csvResponse } from "../leads/route";

export const dynamic = "force-dynamic";

/**
 * Export der Qualifizierungsliste: enthält zusätzlich die wichtigsten
 * Findings, damit ein Vertriebsmitarbeiter den Gesprächsaufhänger direkt in
 * der Tabelle sieht.
 */
export async function GET(request: NextRequest) {
  const session = await requireSessionContext();
  const params = request.nextUrl.searchParams;

  const filters: QualificationFilters = {
    score: params.get("score") === "HIGH" ? "HIGH" : "ANY",
    agency: params.get("agency") === "FOUND" || params.get("agency") === "NONE"
      ? (params.get("agency") as "FOUND" | "NONE")
      : "ANY",
    analysis: ["MISSING", "DONE", "FAILED"].includes(params.get("analysis") ?? "")
      ? (params.get("analysis") as "MISSING" | "DONE" | "FAILED")
      : "ANY",
    industry: params.get("industry")?.trim() || undefined,
    city: params.get("city")?.trim() || undefined,
    search: params.get("search")?.trim() || undefined,
  };

  const rows = await loadQualificationRows(session.organizationId, filters);

  const csv = buildCsv<QualificationRow>(rows, [
    { header: "Firma", value: (row) => row.lead.company_name },
    { header: "Website", value: (row) => row.lead.website_url },
    { header: "PLZ", value: (row) => row.lead.postal_code },
    { header: "Ort", value: (row) => row.lead.city },
    { header: "Branche", value: (row) => row.lead.industry },
    { header: "Analysepotenzial", value: (row) => csvNumber(row.lead.potential_score) },
    { header: "Status", value: (row) => LEAD_STATUS_LABELS[row.lead.status] },
    {
      header: "Analyse",
      value: (row) => (row.analysis ? ANALYSIS_STATUS_LABELS[row.analysis.status] : "Nicht analysiert"),
    },
    { header: "Analysiert am", value: (row) => csvDate(row.analysis?.created_at ?? null) },
    { header: "Agenturhinweis", value: (row) => csvBoolean(row.lead.has_agency) },
    { header: "Erkannte Agentur", value: (row) => row.lead.detected_agency_name },
    {
      header: "Wichtigste Findings",
      value: (row) =>
        (row.analysis?.findings ?? [])
          .filter((finding) => finding.points > 0)
          .sort((a, b) => b.points - a.points)
          .slice(0, 5)
          .map((finding) => `${finding.title} (+${finding.points})`)
          .join(" | "),
    },
    { header: "Telefon", value: (row) => row.lead.phone },
    { header: "E-Mail", value: (row) => row.lead.email },
  ]);

  return csvResponse(csv, csvFilename("kundenradar-qualifizierung"));
}
