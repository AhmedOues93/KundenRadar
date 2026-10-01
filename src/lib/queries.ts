import "server-only";

import { likePattern, sanitizeSearchTerm } from "@/lib/search-term";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Lead, LeadStatus, WebsiteAnalysis } from "@/lib/types";

export type DashboardStats = {
  totalLeads: number;
  analyzedWebsites: number;
  interestingLeads: number;
  byStatus: Record<LeadStatus, number>;
};

const EMPTY_STATUS_COUNTS: Record<LeadStatus, number> = {
  NEW: 0,
  ANALYZED: 0,
  REVIEW: 0,
  TO_CONTACT: 0,
  CONTACTED: 0,
  REPLIED: 0,
  MEETING: 0,
  OFFER: 0,
  WON: 0,
  LOST: 0,
  ARCHIVED: 0,
};

/** Ab diesem Score gilt ein Lead als „interessant" (Band ab 60). */
export const INTERESTING_SCORE_THRESHOLD = 60;

export async function loadDashboardStats(organizationId: string): Promise<DashboardStats> {
  const supabase = await createServerSupabase();

  const [{ data: leadRows, error: leadError }, { count: analysisCount }] = await Promise.all([
    supabase
      .from("leads")
      .select("status, potential_score")
      .eq("organization_id", organizationId),
    supabase
      .from("website_analyses")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "SUCCESS"),
  ]);

  if (leadError) throw new Error(`Leads konnten nicht geladen werden: ${leadError.message}`);

  const byStatus = { ...EMPTY_STATUS_COUNTS };
  let interestingLeads = 0;

  for (const row of leadRows ?? []) {
    const status = row.status as LeadStatus;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if ((row.potential_score ?? 0) >= INTERESTING_SCORE_THRESHOLD && status !== "ARCHIVED") {
      interestingLeads += 1;
    }
  }

  return {
    totalLeads: (leadRows ?? []).length,
    analyzedWebsites: analysisCount ?? 0,
    interestingLeads,
    byStatus,
  };
}

export async function loadRecentLeads(organizationId: string, limit = 8): Promise<Lead[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("organization_id", organizationId)
    .neq("status", "ARCHIVED")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Leads konnten nicht geladen werden: ${error.message}`);
  return (data ?? []) as Lead[];
}

export type LeadFilters = {
  search?: string;
  status?: LeadStatus | "ALL" | "ACTIVE";
  city?: string;
  industry?: string;
  sort?: "score" | "created" | "company";
};

export async function loadLeads(
  organizationId: string,
  filters: LeadFilters,
): Promise<Lead[]> {
  const supabase = await createServerSupabase();
  let query = supabase.from("leads").select("*").eq("organization_id", organizationId);

  if (!filters.status || filters.status === "ACTIVE") {
    query = query.neq("status", "ARCHIVED");
  } else if (filters.status !== "ALL") {
    query = query.eq("status", filters.status);
  }

  if (filters.city) query = query.ilike("city", likePattern(filters.city));
  if (filters.industry) query = query.ilike("industry", likePattern(filters.industry));

  if (sanitizeSearchTerm(filters.search ?? "")) {
    const term = likePattern(filters.search as string);
    query = query.or(
      [
        `company_name.ilike.${term}`,
        `domain.ilike.${term}`,
        `city.ilike.${term}`,
        `industry.ilike.${term}`,
        `contact_person.ilike.${term}`,
        `email.ilike.${term}`,
      ].join(","),
    );
  }

  if (filters.sort === "company") query = query.order("company_name", { ascending: true });
  else if (filters.sort === "created") query = query.order("created_at", { ascending: false });
  else query = query.order("potential_score", { ascending: false, nullsFirst: false });

  const { data, error } = await query.limit(300);
  if (error) throw new Error(`Leads konnten nicht geladen werden: ${error.message}`);
  return (data ?? []) as Lead[];
}

/** Vorhandene Orte und Branchen für die Filter-Auswahllisten. */
export async function loadLeadFacets(
  organizationId: string,
): Promise<{ cities: string[]; industries: string[] }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("city, industry")
    .eq("organization_id", organizationId)
    .limit(1000);

  if (error) return { cities: [], industries: [] };

  const cities = new Set<string>();
  const industries = new Set<string>();
  for (const row of data ?? []) {
    if (row.city) cities.add(row.city as string);
    if (row.industry) industries.add(row.industry as string);
  }

  const collator = new Intl.Collator("de-DE");
  return {
    cities: [...cities].sort(collator.compare),
    industries: [...industries].sort(collator.compare),
  };
}

export async function loadLead(organizationId: string, leadId: string): Promise<Lead | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", leadId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Lead;
}

export async function loadAnalyses(
  organizationId: string,
  options: { leadId?: string; limit?: number } = {},
): Promise<WebsiteAnalysis[]> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("website_analyses")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);

  if (options.leadId) query = query.eq("lead_id", options.leadId);

  const { data, error } = await query;
  if (error) throw new Error(`Analysen konnten nicht geladen werden: ${error.message}`);
  return (data ?? []) as WebsiteAnalysis[];
}

export async function loadAnalysis(
  organizationId: string,
  analysisId: string,
): Promise<WebsiteAnalysis | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("website_analyses")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", analysisId)
    .maybeSingle();

  if (error || !data) return null;
  return data as WebsiteAnalysis;
}

/* -------------------------------------------------------------------------- */
/* Qualifizierung (Phase 2)                                                   */
/* -------------------------------------------------------------------------- */

export type QualificationFilters = {
  score?: "HIGH" | "ANY";
  agency?: "FOUND" | "NONE" | "ANY";
  analysis?: "DONE" | "MISSING" | "FAILED" | "ANY";
  industry?: string;
  city?: string;
  search?: string;
};

export type QualificationRow = {
  lead: Lead;
  /** Jüngste Analyse des Leads, falls vorhanden. */
  analysis: Pick<
    WebsiteAnalysis,
    "id" | "status" | "score" | "findings" | "error_message" | "created_at"
  > | null;
};

/**
 * Leads mit ihrer jüngsten Analyse, standardmässig nach höchstem
 * Analysepotenzial sortiert.
 *
 * Die Analysen werden in einem zweiten Zugriff über `last_analysis_id` geholt –
 * das bleibt nachvollziehbar und unabhängig von Join-Namen in Supabase.
 */
export async function loadQualificationRows(
  organizationId: string,
  filters: QualificationFilters,
): Promise<QualificationRow[]> {
  const supabase = await createServerSupabase();

  let query = supabase
    .from("leads")
    .select("*")
    .eq("organization_id", organizationId)
    .neq("status", "ARCHIVED");

  if (filters.industry) query = query.ilike("industry", likePattern(filters.industry));
  if (filters.city) query = query.ilike("city", likePattern(filters.city));
  if (sanitizeSearchTerm(filters.search ?? "")) {
    const term = likePattern(filters.search as string);
    query = query.or([`company_name.ilike.${term}`, `domain.ilike.${term}`].join(","));
  }

  if (filters.score === "HIGH") {
    query = query.gte("potential_score", INTERESTING_SCORE_THRESHOLD);
  }
  if (filters.agency === "FOUND") query = query.eq("has_agency", true);
  if (filters.agency === "NONE") query = query.eq("has_agency", false);
  if (filters.analysis === "MISSING") query = query.is("last_analysis_id", null);
  if (filters.analysis === "DONE" || filters.analysis === "FAILED") {
    query = query.not("last_analysis_id", "is", null);
  }

  const { data, error } = await query
    .order("potential_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) throw new Error(`Leads konnten nicht geladen werden: ${error.message}`);

  const leads = (data ?? []) as Lead[];
  const analysisIds = leads
    .map((lead) => lead.last_analysis_id)
    .filter((id): id is string => Boolean(id));

  const analysisById = new Map<string, QualificationRow["analysis"]>();
  if (analysisIds.length > 0) {
    const { data: analyses } = await supabase
      .from("website_analyses")
      .select("id, status, score, findings, error_message, created_at")
      .eq("organization_id", organizationId)
      .in("id", analysisIds);

    for (const row of analyses ?? []) {
      analysisById.set(row.id as string, row as QualificationRow["analysis"]);
    }
  }

  const rows: QualificationRow[] = leads.map((lead) => ({
    lead,
    analysis: lead.last_analysis_id ? analysisById.get(lead.last_analysis_id) ?? null : null,
  }));

  // Der Analysestatus steckt in der Analyse, nicht im Lead – deshalb wird hier
  // nachgefiltert.
  if (filters.analysis === "FAILED") {
    return rows.filter(
      (row) => row.analysis?.status === "FAILED" || row.analysis?.status === "BLOCKED",
    );
  }
  if (filters.analysis === "DONE") {
    return rows.filter((row) => row.analysis?.status === "SUCCESS");
  }

  return rows;
}

/** Kennzahlen für das Dashboard, die aus Phase 2 hinzukommen. */
export async function loadDiscoveryStats(organizationId: string): Promise<{
  fromDiscovery: number;
  notAnalyzed: number;
  highPotential: number;
  agencyHints: number;
}> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("source, last_analysis_id, potential_score, has_agency, status")
    .eq("organization_id", organizationId)
    .neq("status", "ARCHIVED")
    .limit(5000);

  if (error) throw new Error(`Kennzahlen konnten nicht geladen werden: ${error.message}`);

  let fromDiscovery = 0;
  let notAnalyzed = 0;
  let highPotential = 0;
  let agencyHints = 0;

  for (const row of data ?? []) {
    if (row.source === "DISCOVERY") fromDiscovery += 1;
    if (!row.last_analysis_id) notAnalyzed += 1;
    if ((row.potential_score ?? 0) >= INTERESTING_SCORE_THRESHOLD) highPotential += 1;
    if (row.has_agency) agencyHints += 1;
  }

  return { fromDiscovery, notAnalyzed, highPotential, agencyHints };
}
