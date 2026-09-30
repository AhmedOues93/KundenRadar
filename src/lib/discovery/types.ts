/**
 * Provider-Abstraktion für die Lead-Suche.
 *
 * Die Anwendung darf nicht von einer einzelnen Datenquelle abhängen. Jede
 * Quelle implementiert `LeadDiscoveryProvider` und liefert `DiscoveryCandidate`
 * zurück; alles darüber (Duplikatabgleich, Auswahl, Import, Analyse) ist von
 * der Quelle unabhängig.
 */

export const DISCOVERY_PROVIDERS = ["OSM_OVERPASS"] as const;
export type DiscoveryProviderId = (typeof DISCOVERY_PROVIDERS)[number];

export const MATCH_STATUSES = [
  "NEW",
  "DUPLICATE_DOMAIN",
  "DUPLICATE_NAME_ADDRESS",
  "DUPLICATE_IN_RESULT",
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export type DiscoveryQuery = {
  /** Ortsname, wie der Benutzer ihn eingegeben hat. */
  city: string;
  /** Suchradius um den Ortsmittelpunkt in Kilometern. */
  radiusKm: number;
  /** Schlüssel aus dem Branchenkatalog, z. B. `elektriker`. */
  industry: string;
  maxResults: number;
};

/** Ein Treffer der Datenquelle – noch kein Lead. */
export type DiscoveryCandidate = {
  provider: DiscoveryProviderId;
  /** Stabile Kennung innerhalb der Quelle, z. B. `node/123456`. */
  externalId: string;
  companyName: string;
  industry: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  websiteUrl: string | null;
  domain: string | null;
  phone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Öffentlich einsehbarer Datensatz der Quelle. */
  sourceUrl: string | null;
  /** Rohdaten der Quelle, für Nachvollziehbarkeit gespeichert. */
  raw: Record<string, unknown>;
};

export type DiscoveryResult = {
  provider: DiscoveryProviderId;
  /** Vom Geocoder aufgelöster Ort, z. B. „Köln, Nordrhein-Westfalen". */
  resolvedPlace: string | null;
  centerLat: number | null;
  centerLon: number | null;
  candidates: DiscoveryCandidate[];
  /**
   * Nicht blockierende Hinweise, z. B. wenn die Quelle die Ergebnisse
   * begrenzt hat.
   */
  notices: string[];
};

export interface LeadDiscoveryProvider {
  readonly id: DiscoveryProviderId;
  readonly label: string;
  /** Kurzer Hinweis auf Herkunft und Lizenz, wird in der UI angezeigt. */
  readonly attribution: string;
  search(query: DiscoveryQuery, signal?: AbortSignal): Promise<DiscoveryResult>;
}

/** Fehler, dessen Meldung dem Benutzer gezeigt werden darf. */
export class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryError";
  }
}
