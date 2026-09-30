import type { DiscoveryCandidate, MatchStatus } from "./types";

/**
 * Duplikaterkennung für Discovery-Treffer.
 *
 * Zwei Wege:
 *   1. Domain – der verlässlichere Schlüssel.
 *   2. Firmenname + Adresse – für Firmen ohne Website.
 *
 * Bewusst rein und ohne Datenbankzugriff, damit die Regeln testbar bleiben.
 */

export type ExistingLeadRef = {
  id: string;
  companyName: string;
  domain: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
};

export type CandidateMatch = {
  candidate: DiscoveryCandidate;
  status: MatchStatus;
  /** Gesetzt, wenn der Treffer auf einen bestehenden Lead verweist. */
  existingLeadId: string | null;
};

/** Normalisiert eine Domain: Kleinbuchstaben, ohne `www.` und Punkt am Ende. */
export function normalizeDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const domain = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.$/, "");
  return domain.length > 0 ? domain : null;
}

/**
 * Normalisiert einen Firmennamen für den Vergleich: Rechtsform, Satzzeichen
 * und Mehrfach-Leerzeichen fallen weg, Umlaute werden aufgelöst.
 */
export function normalizeCompanyName(value: string | null | undefined): string {
  if (!value) return "";
  let name = foldGerman(value.toLowerCase());

  // Gängige Rechtsformen und Zusätze entfernen.
  name = name.replace(
    /\b(gmbh\s*&\s*co\.?\s*kg|gmbh|mbh|ug|ag|kg|ohg|gbr|e\.?\s*k\.?|e\.?\s*v\.?|ev|se|partg|mbb|co\.?\s*kg|inh\.?|und\s+sohn|und\s+soehne|&\s*co\.?|ltd|plc|inc)\b/g,
    " ",
  );
  name = name.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return name;
}

/** Normalisiert eine Adresse: Strassenkürzel vereinheitlicht, PLZ und Ort angehängt. */
export function normalizeAddress(input: {
  street: string | null | undefined;
  postalCode: string | null | undefined;
  city: string | null | undefined;
}): string {
  const street = foldGerman((input.street ?? "").toLowerCase())
    // „str.", „strasse", „straße" auf eine Form bringen.
    .replace(/stra(?:ss|s)e\b/g, "str")
    .replace(/\bstr\.?\b/g, "str")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const postalCode = (input.postalCode ?? "").replace(/[^0-9a-zA-Z]/g, "");
  const city = foldGerman((input.city ?? "").toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return [street, postalCode, city].filter(Boolean).join("|");
}

function foldGerman(value: string): string {
  return value
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

/** Schlüssel für den Vergleich über Name + Adresse. */
export function nameAddressKey(input: {
  companyName: string | null | undefined;
  street: string | null | undefined;
  postalCode: string | null | undefined;
  city: string | null | undefined;
}): string | null {
  const name = normalizeCompanyName(input.companyName);
  if (!name) return null;
  const address = normalizeAddress(input);
  // Ohne jede Ortsangabe wäre der Schlüssel zu unscharf – dann kein Abgleich.
  if (!address) return null;
  return `${name}#${address}`;
}

/**
 * Ordnet jedem Treffer einen Status zu: neu, oder Duplikat eines bestehenden
 * Leads bzw. eines vorherigen Treffers derselben Ergebnisliste.
 *
 * Die Reihenfolge der Treffer bleibt erhalten.
 */
export function classifyCandidates(
  candidates: DiscoveryCandidate[],
  existingLeads: ExistingLeadRef[],
): CandidateMatch[] {
  const byDomain = new Map<string, string>();
  const byNameAddress = new Map<string, string>();

  for (const lead of existingLeads) {
    const domain = normalizeDomain(lead.domain);
    if (domain && !byDomain.has(domain)) byDomain.set(domain, lead.id);

    const key = nameAddressKey(lead);
    if (key && !byNameAddress.has(key)) byNameAddress.set(key, lead.id);
  }

  const seenDomains = new Set<string>();
  const seenNameAddress = new Set<string>();
  const seenExternalIds = new Set<string>();

  return candidates.map((candidate) => {
    const domain = normalizeDomain(candidate.domain ?? candidate.websiteUrl);
    const key = nameAddressKey(candidate);

    // Derselbe Datensatz zweimal in einer Antwort (z. B. Node und Way).
    if (seenExternalIds.has(candidate.externalId)) {
      return { candidate, status: "DUPLICATE_IN_RESULT" as MatchStatus, existingLeadId: null };
    }
    seenExternalIds.add(candidate.externalId);

    if (domain) {
      const existing = byDomain.get(domain);
      if (existing) {
        return { candidate, status: "DUPLICATE_DOMAIN" as MatchStatus, existingLeadId: existing };
      }
      if (seenDomains.has(domain)) {
        return { candidate, status: "DUPLICATE_IN_RESULT" as MatchStatus, existingLeadId: null };
      }
    }

    if (key) {
      const existing = byNameAddress.get(key);
      if (existing) {
        return {
          candidate,
          status: "DUPLICATE_NAME_ADDRESS" as MatchStatus,
          existingLeadId: existing,
        };
      }
      if (seenNameAddress.has(key)) {
        return { candidate, status: "DUPLICATE_IN_RESULT" as MatchStatus, existingLeadId: null };
      }
    }

    if (domain) seenDomains.add(domain);
    if (key) seenNameAddress.add(key);

    return { candidate, status: "NEW" as MatchStatus, existingLeadId: null };
  });
}

/** Ein Treffer gilt als „sinnvoll", wenn er neu ist und eine Website hat. */
export function isWorthImporting(match: CandidateMatch): boolean {
  return match.status === "NEW" && Boolean(match.candidate.websiteUrl);
}
