import "server-only";

import type { z } from "zod";
import type { ActivityType } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Ergebnisobjekt für alle Server Actions, die von Formularen aufgerufen werden. */
export type ActionState = {
  ok: boolean;
  message?: string;
  /** Feldbezogene Fehler, Schlüssel = Formularfeldname. */
  errors?: Record<string, string>;
  /** Zusätzliche Nutzlast, z. B. ein einmalig angezeigter Einladungslink. */
  data?: Record<string, string>;
};

export const OK: ActionState = { ok: true };

export function failed(message: string, errors?: Record<string, string>): ActionState {
  return { ok: false, message, errors };
}

/** Schreibt einen Audit-Eintrag. Fehler hier dürfen die Hauptaktion nicht kippen. */
export async function logActivity(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    leadId: string;
    type: ActivityType;
    message: string;
    userId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("lead_activities").insert({
    organization_id: input.organizationId,
    lead_id: input.leadId,
    type: input.type,
    message: input.message,
    created_by: input.userId,
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.error("Aktivität konnte nicht protokolliert werden:", error.message);
  }
}

/** Leert leere Strings zu `null`, damit keine Leerwerte in der DB landen. */
export function nullable(value: FormDataEntryValue | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function text(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Zod-Fehler auf Formularfelder abbilden; erster Fehler je Feld gewinnt. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
