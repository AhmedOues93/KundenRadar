import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type { MatchStatus } from "./types";

export type DiscoveryRun = {
  id: string;
  provider: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  city: string;
  radius_km: number;
  industry: string;
  industry_label: string | null;
  max_results: number;
  resolved_place: string | null;
  result_count: number;
  new_count: number;
  duplicate_count: number;
  imported_count: number;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
};

export type DiscoveryCandidateRow = {
  id: string;
  discovery_run_id: string;
  provider: string;
  external_id: string;
  company_name: string;
  industry: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  website_url: string | null;
  domain: string | null;
  phone: string | null;
  email: string | null;
  source_url: string | null;
  match_status: MatchStatus;
  existing_lead_id: string | null;
  imported_lead_id: string | null;
};

export async function loadDiscoveryRuns(
  organizationId: string,
  limit = 20,
): Promise<DiscoveryRun[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("lead_discovery_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Suchläufe konnten nicht geladen werden: ${error.message}`);
  return (data ?? []) as DiscoveryRun[];
}

export async function loadDiscoveryRun(
  organizationId: string,
  runId: string,
): Promise<DiscoveryRun | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("lead_discovery_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", runId)
    .maybeSingle();

  if (error || !data) return null;
  return data as DiscoveryRun;
}

export async function loadDiscoveryCandidates(
  organizationId: string,
  runId: string,
): Promise<DiscoveryCandidateRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("lead_discovery_candidates")
    .select(
      "id, discovery_run_id, provider, external_id, company_name, industry, street, postal_code, city, website_url, domain, phone, email, source_url, match_status, existing_lead_id, imported_lead_id",
    )
    .eq("organization_id", organizationId)
    .eq("discovery_run_id", runId)
    // Treffer mit Website zuerst, danach alphabetisch.
    .order("website_url", { ascending: false, nullsFirst: false })
    .order("company_name", { ascending: true })
    .limit(300);

  if (error) throw new Error(`Treffer konnten nicht geladen werden: ${error.message}`);
  return (data ?? []) as DiscoveryCandidateRow[];
}

/** Herkunftsdaten eines Leads, für die Lead-Detailseite. */
export async function loadLeadSource(
  organizationId: string,
  leadId: string,
): Promise<{ provider: string; external_id: string; source_url: string | null } | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("lead_source_metadata")
    .select("provider, external_id, source_url")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .maybeSingle();

  if (error || !data) return null;
  return data as { provider: string; external_id: string; source_url: string | null };
}
