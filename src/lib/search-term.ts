/**
 * Aufbereitung von Suchbegriffen für PostgREST-Filter.
 *
 * Zwei getrennte Probleme:
 *
 * 1. **Struktur.** Mehrere Bedingungen werden als `or=(a.ilike.x,b.ilike.y)`
 *    übergeben. PostgREST trennt an Kommas und Klammern – ein Komma im
 *    Suchbegriff zerlegt daher den Ausdruck. Ein Backslash davor hilft nicht,
 *    das ist nicht der vorgesehene Mechanismus.
 *
 * 2. **Platzhalter.** `%`, `_` und (bei PostgREST) `*` wirken in `ilike` als
 *    Platzhalter. Wer „50%" sucht, meint das Zeichen, nicht „beliebiger Text".
 *
 * Deshalb: strukturelle Zeichen entfernen, Platzhalter maskieren.
 */

/** Zeichen, die den Filterausdruck zerlegen könnten. */
const STRUCTURAL = /[,()"\\*]/g;

const MAX_LENGTH = 80;

export function sanitizeSearchTerm(input: string): string {
  return input
    .replace(STRUCTURAL, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LENGTH)
    .trim();
}

/**
 * Baut das `ilike`-Muster für eine Teilstringsuche. Platzhalter im Begriff
 * werden mit Backslash maskiert – der Standard-Escape von Postgres.
 */
export function likePattern(input: string): string {
  const safe = sanitizeSearchTerm(input).replace(/[%_]/g, (match) => `\\${match}`);
  return `%${safe}%`;
}

/** Leere Begriffe sollen keinen Filter erzeugen. */
export function hasSearchContent(input: string | null | undefined): boolean {
  return typeof input === "string" && sanitizeSearchTerm(input).length > 0;
}
