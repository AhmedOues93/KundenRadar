import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisResult } from "@/lib/types";
import { logActivity } from "./shared";

/**
 * Speichert ein Analyseergebnis und schreibt den Lead fort.
 *
 * Gemeinsame Ablage für die Einzelanalyse und die Stapel-Analyse, damit beide
 * Wege dieselben Felder und dieselbe Statuslogik verwenden.
 */
export async function persistAnalysis(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    leadId: string | null;
    result: AnalysisResult;
  },
): Promise<{ analysisId: string } | { error: string }> {
  const { organizationId, userId, leadId, result } = input;

  const { data: inserted, error: insertError } = await supabase
    .from("website_analyses")
    .insert({
      organization_id: organizationId,
      lead_id: leadId,
      requested_url: result.requestedUrl,
      final_url: result.finalUrl,
      domain: result.domain,
      status: result.status,
      error_message: result.errorMessage,
      http_status: result.metrics?.httpStatus ?? null,
      response_time_ms: result.metrics?.responseTimeMs ?? null,
      score: result.score,
      findings: result.findings,
      metrics: result.metrics ?? {},
      agency_hint: result.agencyHint,
      created_by: userId,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { error: insertError?.message ?? "Die Analyse konnte nicht gespeichert werden." };
  }

  if (!leadId) return { analysisId: inserted.id };

  const update: Record<string, unknown> = {
    last_analysis_id: inserted.id,
    last_analyzed_at: new Date().toISOString(),
  };

  if (result.status === "SUCCESS") {
    update.potential_score = result.score;
    update.has_agency = result.agencyHint?.found ?? false;
    update.detected_agency_name = result.agencyHint?.agencyName ?? null;

    // Der Status wird nur vom Startzustand fortgeschrieben; eine bereits
    // laufende Akquise darf eine Analyse nicht zurücksetzen.
    const { data: lead } = await supabase
      .from("leads")
      .select("status")
      .eq("id", leadId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (lead?.status === "NEW") update.status = "ANALYZED";
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update(update)
    .eq("id", leadId)
    .eq("organization_id", organizationId);

  if (updateError) {
    return { error: `Der Lead konnte nicht aktualisiert werden: ${updateError.message}` };
  }

  await logActivity(supabase, {
    organizationId,
    leadId,
    type: "ANALYSIS_RUN",
    message:
      result.status === "SUCCESS"
        ? `Website analysiert – Analysepotenzial ${result.score}/100.`
        : `Analyse nicht möglich: ${result.errorMessage}`,
    userId,
    metadata: { analysisId: inserted.id, status: result.status },
  });

  return { analysisId: inserted.id };
}
