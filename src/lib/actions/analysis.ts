"use server";

import { revalidatePath } from "next/cache";
import { requireSessionContext } from "@/lib/auth";
import { analyzeWebsite } from "@/lib/analysis/run";
import { normalizeUrl } from "@/lib/analysis/url-guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { persistAnalysis } from "./analysis-store";
import { type ActionState, failed, text } from "./shared";

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

  const stored = await persistAnalysis(supabase, {
    organizationId: session.organizationId,
    userId: session.userId,
    leadId,
    result,
  });

  if ("error" in stored) return failed(stored.error);

  if (leadId) {
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");
  }

  revalidatePath("/analysen");
  revalidatePath("/dashboard");
  revalidatePath("/qualifizierung");

  if (result.status !== "SUCCESS") {
    return failed(result.errorMessage ?? "Die Analyse ist fehlgeschlagen.");
  }

  return {
    ok: true,
    message: `Analyse abgeschlossen – Analysepotenzial ${result.score}/100.`,
  };
}
