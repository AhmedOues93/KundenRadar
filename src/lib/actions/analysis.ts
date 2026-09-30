"use server";

import { revalidatePath } from "next/cache";
import { requireSessionContext } from "@/lib/auth";
import { analyzeWebsite } from "@/lib/analysis/run";
import { normalizeUrl } from "@/lib/analysis/url-guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { type ActionState, failed, logActivity, text } from "./shared";

/**
 * Startet eine Website-Analyse. Laeuft ausschliesslich serverseitig – die
 * SSRF-Prüfung darf nicht im Browser umgangen werden können.
 */
export async function runAnalysis(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSessionContext();
  const leadId = text(formData.get("leadId")) || null;
  const inputUrl = text(formData.get("url"));

  if (!inputUrl) {
    return failed("Bitte eine Website-Adresse angeben.", { url: "Adresse fehlt." });
  }

  // Frühe Formatprüfung, damit offensichtlich falsche Eingaben keinen
  // Datenbankeintrag erzeugen.
  try {
    normalizeUrl(inputUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die Adresse ist ungültig.";
    return failed(message, { url: message });
  }

  const supabase = await createServerSupabase();

  // Lead-Zugehörigkeit prüfen, bevor die Analyse an ihn gehängt wird.
  if (leadId) {
    const { data: lead, error } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();
    if (error || !lead) return failed("Lead wurde nicht gefunden.");
  }

  const result = await analyzeWebsite(inputUrl);

  const { data: inserted, error: insertError } = await supabase
    .from("website_analyses")
    .insert({
      organization_id: session.organizationId,
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
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (insertError) {
    return failed(`Die Analyse konnte nicht gespeichert werden: ${insertError.message}`);
  }

  if (leadId) {
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
        .single();
      if (lead?.status === "NEW") update.status = "ANALYZED";
    }

    await supabase
      .from("leads")
      .update(update)
      .eq("id", leadId)
      .eq("organization_id", session.organizationId);

    await logActivity(supabase, {
      organizationId: session.organizationId,
      leadId,
      type: "ANALYSIS_RUN",
      message:
        result.status === "SUCCESS"
          ? `Website analysiert – Analysepotenzial ${result.score}/100.`
          : `Analyse nicht möglich: ${result.errorMessage}`,
      userId: session.userId,
      metadata: { analysisId: inserted.id, status: result.status },
    });

    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");
  }

  revalidatePath("/analysen");
  revalidatePath("/dashboard");

  if (result.status !== "SUCCESS") {
    return failed(result.errorMessage ?? "Die Analyse ist fehlgeschlagen.");
  }

  return {
    ok: true,
    message: `Analyse abgeschlossen – Analysepotenzial ${result.score}/100.`,
  };
}
