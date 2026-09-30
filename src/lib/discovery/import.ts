import { classifyCandidates, type ExistingLeadRef } from "./dedupe";
import type { DiscoveryCandidate, MatchStatus } from "./types";
import type { LeadSource } from "@/lib/types";

/**
 * Abbildung eines Discovery-Treffers auf eine Lead-Zeile.
 *
 * Rein und ohne Datenbankzugriff, damit der Import testbar bleibt.
 */
export type LeadInsertRow = {
  organization_id: string;
  company_name: string;
  website_url: string | null;
  domain: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  industry: string | null;
  email: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  source: LeadSource;
  status: "NEW";
  created_by: string;
};

export function candidateToLeadRow(
  candidate: DiscoveryCandidate,
  context: { organizationId: string; userId: string },
): LeadInsertRow {
  return {
    organization_id: context.organizationId,
    company_name: clipRequired(candidate.companyName, 200),
    website_url: candidate.websiteUrl,
    domain: candidate.domain,
    street: clip(candidate.street, 200),
    postal_code: clip(candidate.postalCode, 20),
    city: clip(candidate.city, 120),
    country: clip(candidate.country, 120),
    industry: clip(candidate.industry, 120),
    email: candidate.email,
    phone: clip(candidate.phone, 60),
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    source: "DISCOVERY",
    status: "NEW",
    created_by: context.userId,
  };
}

/** Wie `clip`, liefert aber immer einen Wert – der Firmenname ist Pflicht. */
function clipRequired(value: string, maxLength: number): string {
  const trimmed = value.trim();
  const safe = trimmed.length > 0 ? trimmed : "Unbenannte Firma";
  return safe.length > maxLength ? safe.slice(0, maxLength) : safe;
}

function clip(value: string | null, maxLength: number): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

/* -------------------------------------------------------------------------- */
/* Importplanung                                                              */
/* -------------------------------------------------------------------------- */

export type ImportPlanEntry<T> = {
  /** Referenz auf die Eingabe, z. B. die Kennung des Treffers. */
  ref: T;
  candidate: DiscoveryCandidate;
  status: MatchStatus;
  existingLeadId: string | null;
};

export type ImportPlan<T> = {
  /** Treffer, aus denen ein Lead angelegt wird. */
  toInsert: ImportPlanEntry<T>[];
  /** Treffer, die als Duplikat übersprungen werden. */
  toSkip: ImportPlanEntry<T>[];
};

/**
 * Entscheidet, welche der ausgewählten Treffer importiert werden.
 *
 * Wird unmittelbar vor dem Schreiben gegen den aktuellen Lead-Bestand
 * aufgerufen: zwischen Suche und Import können Leads entstanden sein, etwa
 * durch einen zweiten Benutzer.
 */
export function planImport<T>(
  selected: { ref: T; candidate: DiscoveryCandidate }[],
  existingLeads: ExistingLeadRef[],
): ImportPlan<T> {
  const matches = classifyCandidates(
    selected.map((entry) => entry.candidate),
    existingLeads,
  );

  const toInsert: ImportPlanEntry<T>[] = [];
  const toSkip: ImportPlanEntry<T>[] = [];

  for (const [index, match] of matches.entries()) {
    const source = selected[index];
    if (!source) continue;

    const entry: ImportPlanEntry<T> = {
      ref: source.ref,
      candidate: match.candidate,
      status: match.status,
      existingLeadId: match.existingLeadId,
    };

    if (match.status === "NEW") toInsert.push(entry);
    else toSkip.push(entry);
  }

  return { toInsert, toSkip };
}
