"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSessionContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { runAnalysisBatch } from "@/lib/analysis/batch";
import { BATCH_DEFAULTS } from "@/lib/analysis/batch-limits";
import { classifyCandidates, type ExistingLeadRef } from "@/lib/discovery/dedupe";
import { candidateToLeadRow, planImport } from "@/lib/discovery/import";
import { DISCOVERY_LIMITS, findIndustry } from "@/lib/discovery/industries";
import { DEFAULT_PROVIDER_ID, getProvider } from "@/lib/discovery/registry";
import { DiscoveryError, type DiscoveryCandidate } from "@/lib/discovery/types";
import { persistAnalysis } from "./analysis-store";
import { type ActionState, failed, fieldErrors, logActivity, text } from "./shared";

const querySchema = z.object({
  city: z.string().trim().min(2, "Bitte einen Ort angeben.").max(120),
  radiusKm: z.coerce
    .number()
    .int()
    .min(DISCOVERY_LIMITS.minRadiusKm, "Der Radius ist zu klein.")
    .max(DISCOVERY_LIMITS.maxRadiusKm, "Der Radius ist zu gross."),
  industry: z.string().trim().min(1, "Bitte eine Branche wählen."),
  maxResults: z.coerce
    .number()
    .int()
    .min(DISCOVERY_LIMITS.minResults)
    .max(DISCOVERY_LIMITS.maxResults),
});

/**
 * Führt eine Lead-Suche aus, gleicht die Treffer gegen bestehende Leads ab und
 * legt Lauf und Treffer ab. Es wird noch kein Lead erzeugt – die Auswahl trifft
 * der Benutzer.
 */
export async function startDiscovery(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionContext();

  const parsed = querySchema.safeParse({
    city: text(formData.get("city")),
    radiusKm: text(formData.get("radiusKm")) || "10",
    industry: text(formData.get("industry")),
    maxResults: text(formData.get("maxResults")) || "50",
  });

  if (!parsed.success) return failed("Bitte Eingaben prüfen.", fieldErrors(parsed.error));

  const industry = findIndustry(parsed.data.industry);
  if (!industry) {
    return failed("Diese Branche ist nicht bekannt.", { industry: "Unbekannte Branche." });
  }

  const supabase = await createServerSupabase();
  const provider = getProvider(DEFAULT_PROVIDER_ID);

  const { data: run, error: runError } = await supabase
    .from("lead_discovery_runs")
    .insert({
      organization_id: session.organizationId,
      provider: provider.id,
      status: "PENDING",
      city: parsed.data.city,
      radius_km: parsed.data.radiusKm,
      industry: industry.key,
      industry_label: industry.label,
      max_results: parsed.data.maxResults,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (runError || !run) {
    return failed(`Die Suche konnte nicht gestartet werden: ${runError?.message ?? "unbekannt"}`);
  }

  try {
    const result = await provider.search({
      city: parsed.data.city,
      radiusKm: parsed.data.radiusKm,
      industry: industry.key,
      maxResults: parsed.data.maxResults,
    });

    const existing = await loadExistingLeadRefs(supabase, session.organizationId);
    const matches = classifyCandidates(result.candidates, existing);

    // Die Treffertabelle hat einen eindeutigen Schlüssel auf
    // (Lauf, Quelle, external_id). Liefert die Quelle denselben Datensatz
    // zweimal, soll das nicht den gesamten Lauf scheitern lassen.
    const seenExternalIds = new Set<string>();
    const insertable = matches.filter((match) => {
      if (seenExternalIds.has(match.candidate.externalId)) return false;
      seenExternalIds.add(match.candidate.externalId);
      return true;
    });

    if (insertable.length > 0) {
      const { error: candidateError } = await supabase.from("lead_discovery_candidates").insert(
        insertable.map((match) => ({
          organization_id: session.organizationId,
          discovery_run_id: run.id,
          provider: match.candidate.provider,
          external_id: match.candidate.externalId,
          company_name: match.candidate.companyName,
          industry: match.candidate.industry,
          street: match.candidate.street,
          postal_code: match.candidate.postalCode,
          city: match.candidate.city,
          country: match.candidate.country,
          website_url: match.candidate.websiteUrl,
          domain: match.candidate.domain,
          phone: match.candidate.phone,
          email: match.candidate.email,
          latitude: match.candidate.latitude,
          longitude: match.candidate.longitude,
          source_url: match.candidate.sourceUrl,
          raw: match.candidate.raw,
          match_status: match.status,
          existing_lead_id: match.existingLeadId,
        })),
      );
      if (candidateError) throw new Error(candidateError.message);
    }

    const newCount = insertable.filter((match) => match.status === "NEW").length;

    await supabase
      .from("lead_discovery_runs")
      .update({
        status: "SUCCESS",
        resolved_place: result.resolvedPlace,
        center_lat: result.centerLat,
        center_lon: result.centerLon,
        result_count: insertable.length,
        new_count: newCount,
        duplicate_count: insertable.length - newCount,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .eq("organization_id", session.organizationId);
  } catch (error) {
    const message =
      error instanceof DiscoveryError
        ? error.message
        : error instanceof Error
          ? `Die Suche ist fehlgeschlagen: ${error.message}`
          : "Die Suche ist fehlgeschlagen.";

    await supabase
      .from("lead_discovery_runs")
      .update({ status: "FAILED", error_message: message, finished_at: new Date().toISOString() })
      .eq("id", run.id)
      .eq("organization_id", session.organizationId);

    // Der Lauf bleibt sichtbar, damit der Fehler nachvollziehbar ist.
    redirect(`/leads/discover?run=${run.id}`);
  }

  revalidatePath("/leads/discover");
  revalidatePath("/dashboard");
  redirect(`/leads/discover?run=${run.id}`);
}

/** Importiert die ausgewählten Treffer als Leads. */
export async function importCandidates(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionContext();
  const runId = text(formData.get("runId"));
  const candidateIds = formData
    .getAll("candidateId")
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (!runId) return failed("Kennung der Suche fehlt.");
  if (candidateIds.length === 0) {
    return failed("Bitte mindestens eine Firma auswählen.");
  }

  const supabase = await createServerSupabase();

  const { data: rows, error } = await supabase
    .from("lead_discovery_candidates")
    .select("*")
    .eq("organization_id", session.organizationId)
    .eq("discovery_run_id", runId)
    .in("id", candidateIds);

  if (error) return failed(`Treffer konnten nicht geladen werden: ${error.message}`);
  if (!rows || rows.length === 0) return failed("Die ausgewählten Treffer wurden nicht gefunden.");

  // Gegen den aktuellen Bestand erneut abgleichen: zwischen Suche und Import
  // können Leads angelegt worden sein, etwa durch einen zweiten Benutzer.
  const existing = await loadExistingLeadRefs(supabase, session.organizationId);
  const plan = planImport(
    rows.map((row) => ({ ref: row.id as string, candidate: rowToCandidate(row) })),
    existing,
  );

  let imported = 0;
  const skipped = plan.toSkip.length;
  const errors: string[] = [];

  // Duplikate: nur den Abgleichstatus nachziehen, kein Lead anlegen.
  for (const entry of plan.toSkip) {
    await supabase
      .from("lead_discovery_candidates")
      .update({ match_status: entry.status, existing_lead_id: entry.existingLeadId })
      .eq("id", entry.ref)
      .eq("organization_id", session.organizationId);
  }

  for (const entry of plan.toInsert) {
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert(
        candidateToLeadRow(entry.candidate, {
          organizationId: session.organizationId,
          userId: session.userId,
        }),
      )
      .select("id")
      .single();

    if (leadError || !lead) {
      // Ein einzelner Fehlschlag darf den Import nicht abbrechen.
      errors.push(`${entry.candidate.companyName}: ${leadError?.message ?? "unbekannter Fehler"}`);
      continue;
    }

    const { error: metadataError } = await supabase.from("lead_source_metadata").insert({
      organization_id: session.organizationId,
      lead_id: lead.id,
      provider: entry.candidate.provider,
      external_id: entry.candidate.externalId,
      source_url: entry.candidate.sourceUrl,
      payload: entry.candidate.raw,
      discovery_run_id: runId,
    });
    if (metadataError) {
      console.error("Herkunftsdaten konnten nicht gespeichert werden:", metadataError.message);
    }

    await supabase
      .from("lead_discovery_candidates")
      .update({ imported_lead_id: lead.id })
      .eq("id", entry.ref)
      .eq("organization_id", session.organizationId);

    await logActivity(supabase, {
      organizationId: session.organizationId,
      leadId: lead.id,
      type: "LEAD_CREATED",
      message: `Lead aus Suche „${entry.candidate.companyName}" importiert.`,
      userId: session.userId,
      metadata: {
        provider: entry.candidate.provider,
        externalId: entry.candidate.externalId,
        discoveryRunId: runId,
      },
    });

    imported += 1;
  }

  if (imported > 0) {
    const { data: run } = await supabase
      .from("lead_discovery_runs")
      .select("imported_count")
      .eq("id", runId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    await supabase
      .from("lead_discovery_runs")
      .update({ imported_count: (run?.imported_count ?? 0) + imported })
      .eq("id", runId)
      .eq("organization_id", session.organizationId);
  }

  revalidatePath("/leads/discover");
  revalidatePath("/leads");
  revalidatePath("/qualifizierung");
  revalidatePath("/dashboard");

  const parts = [`${imported} ${imported === 1 ? "Lead" : "Leads"} importiert`];
  if (skipped > 0) parts.push(`${skipped} als Duplikat übersprungen`);
  if (errors.length > 0) parts.push(`${errors.length} fehlgeschlagen`);

  return {
    ok: errors.length === 0,
    message: `${parts.join(", ")}.${errors.length > 0 ? ` ${errors.slice(0, 3).join("; ")}` : ""}`,
  };
}

/**
 * Analysiert mehrere Leads in einem kontrollierten Stapel. Nutzt die
 * bestehende Analyse aus Phase 1; der SSRF-Schutz bleibt unverändert.
 */
export async function analyzeLeadsBatch(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionContext();
  const leadIds = formData
    .getAll("leadId")
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (leadIds.length === 0) return failed("Bitte mindestens einen Lead auswählen.");

  const supabase = await createServerSupabase();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, company_name, website_url")
    .eq("organization_id", session.organizationId)
    .in("id", leadIds.slice(0, BATCH_DEFAULTS.maxItems));

  if (error) return failed(`Leads konnten nicht geladen werden: ${error.message}`);

  const items = (leads ?? [])
    .filter((lead) => Boolean(lead.website_url))
    .map((lead) => ({ id: lead.id as string, url: lead.website_url as string }));

  const withoutWebsite = (leads ?? []).length - items.length;

  if (items.length === 0) {
    return failed(
      withoutWebsite > 0
        ? "Für die ausgewählten Leads ist keine Website hinterlegt."
        : "Es wurden keine passenden Leads gefunden.",
    );
  }

  const summary = await runAnalysisBatch(items, {
    onSettled: async (outcome) => {
      if (!outcome.ok) {
        if (outcome.skipped) return;
        // Auch ein Fehlschlag wird als Analyse mit Status FAILED abgelegt,
        // damit er in der Qualifizierung sichtbar bleibt.
        await persistAnalysis(supabase, {
          organizationId: session.organizationId,
          userId: session.userId,
          leadId: outcome.id,
          result: {
            requestedUrl: outcome.url,
            finalUrl: null,
            domain: null,
            status: "FAILED",
            errorMessage: outcome.error,
            score: null,
            findings: [],
            metrics: null,
            agencyHint: null,
          },
        });
        return;
      }

      await persistAnalysis(supabase, {
        organizationId: session.organizationId,
        userId: session.userId,
        leadId: outcome.id,
        result: outcome.result,
      });
    },
  });

  revalidatePath("/qualifizierung");
  revalidatePath("/leads");
  revalidatePath("/analysen");
  revalidatePath("/dashboard");

  const parts = [`${summary.succeeded} analysiert`];
  if (summary.failed > 0) parts.push(`${summary.failed} fehlgeschlagen`);
  if (summary.skipped > 0) parts.push(`${summary.skipped} übersprungen`);
  if (withoutWebsite > 0) parts.push(`${withoutWebsite} ohne Website`);

  return {
    ok: summary.succeeded > 0,
    message: `Stapel abgeschlossen: ${parts.join(", ")}.${
      summary.budgetExhausted ? " Das Zeitbudget war erschöpft – bitte den Rest erneut starten." : ""
    }`,
  };
}

/** Bestehende Leads in der für den Abgleich nötigen Form. */
async function loadExistingLeadRefs(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
): Promise<ExistingLeadRef[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("id, company_name, domain, street, postal_code, city")
    .eq("organization_id", organizationId)
    .limit(5000);

  if (error) throw new Error(`Bestehende Leads konnten nicht geladen werden: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    companyName: row.company_name as string,
    domain: (row.domain as string | null) ?? null,
    street: (row.street as string | null) ?? null,
    postalCode: (row.postal_code as string | null) ?? null,
    city: (row.city as string | null) ?? null,
  }));
}

/** Datenbankzeile zurück in einen Treffer, für den erneuten Abgleich. */
function rowToCandidate(row: Record<string, unknown>): DiscoveryCandidate {
  return {
    provider: row.provider as DiscoveryCandidate["provider"],
    externalId: row.external_id as string,
    companyName: row.company_name as string,
    industry: (row.industry as string | null) ?? null,
    street: (row.street as string | null) ?? null,
    postalCode: (row.postal_code as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    websiteUrl: (row.website_url as string | null) ?? null,
    domain: (row.domain as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
    sourceUrl: (row.source_url as string | null) ?? null,
    raw: (row.raw as Record<string, unknown>) ?? {},
  };
}
