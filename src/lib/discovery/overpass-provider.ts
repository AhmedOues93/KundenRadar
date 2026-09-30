import { findIndustry } from "./industries";
import { buildOverpassQuery, mapOverpassElements, type OverpassElement } from "./osm-mapping";
import {
  DiscoveryError,
  type DiscoveryQuery,
  type DiscoveryResult,
  type LeadDiscoveryProvider,
} from "./types";

/**
 * Datenquelle: OpenStreetMap über Overpass, Ortsauflösung über Nominatim.
 *
 * Beides ist öffentlich und legal nutzbar (ODbL). Es wird ausschliesslich die
 * offizielle API angesprochen – kein Scraping von Google Maps, LinkedIn oder
 * vergleichbaren Diensten.
 *
 * Die Nutzungsbedingungen beider Dienste verlangen einen aussagekräftigen
 * User-Agent und maßvolle Abfragen. Deshalb: ein Geocoding- und ein
 * Overpass-Request pro Suche, harte Timeouts und eine begrenzte Trefferzahl.
 */

export const OVERPASS_ENDPOINT =
  process.env.KUNDENRADAR_OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

export const NOMINATIM_ENDPOINT =
  process.env.KUNDENRADAR_NOMINATIM_URL ?? "https://nominatim.openstreetmap.org/search";

const USER_AGENT =
  process.env.KUNDENRADAR_DISCOVERY_USER_AGENT ??
  "KundenRadar/1.0 (Lead-Recherche; +https://kundenradar.example)";

export const OVERPASS_LIMITS = {
  geocodeTimeoutMs: 10_000,
  overpassTimeoutMs: 45_000,
  /** Zeitbudget, das Overpass serverseitig für die Abfrage einräumen darf. */
  overpassQueryTimeoutSeconds: 40,
  /**
   * Overpass wird mit Reserve abgefragt: nach dem Verwerfen namenloser
   * Einträge sollen noch genügend brauchbare Treffer übrig bleiben.
   */
  fetchFactor: 3,
  maxFetch: 600,
} as const;

/** Austauschbarer Transport, damit der Provider ohne Netzwerk testbar ist. */
export type FetchLike = (
  input: string,
  init?: { method?: string; body?: string; headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export type OverpassProviderOptions = {
  fetchImpl?: FetchLike;
  overpassEndpoint?: string;
  nominatimEndpoint?: string;
};

export class OverpassDiscoveryProvider implements LeadDiscoveryProvider {
  readonly id = "OSM_OVERPASS" as const;
  readonly label = "OpenStreetMap (Overpass)";
  readonly attribution = "Daten von OpenStreetMap-Mitwirkenden, ODbL 1.0";

  private readonly fetchImpl: FetchLike;
  private readonly overpassEndpoint: string;
  private readonly nominatimEndpoint: string;

  constructor(options: OverpassProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.overpassEndpoint = options.overpassEndpoint ?? OVERPASS_ENDPOINT;
    this.nominatimEndpoint = options.nominatimEndpoint ?? NOMINATIM_ENDPOINT;
  }

  async search(query: DiscoveryQuery, signal?: AbortSignal): Promise<DiscoveryResult> {
    const industry = findIndustry(query.industry);
    if (!industry) {
      throw new DiscoveryError(`Unbekannte Branche: ${query.industry}`);
    }

    const place = await this.geocode(query.city, signal);

    const fetchLimit = Math.min(
      OVERPASS_LIMITS.maxFetch,
      query.maxResults * OVERPASS_LIMITS.fetchFactor,
    );

    const overpassQuery = buildOverpassQuery({
      selectors: industry.osm,
      lat: place.lat,
      lon: place.lon,
      radiusMeters: query.radiusKm * 1000,
      maxResults: fetchLimit,
      timeoutSeconds: OVERPASS_LIMITS.overpassQueryTimeoutSeconds,
    });

    const elements = await this.runOverpass(overpassQuery, signal);
    const mapped = mapOverpassElements(elements, industry);

    const notices: string[] = [];
    if (elements.length >= fetchLimit) {
      notices.push(
        "Die Datenquelle hat die maximale Trefferzahl geliefert. Ein kleinerer Radius liefert genauere Ergebnisse.",
      );
    }
    const withoutName = elements.length - mapped.length;
    if (withoutName > 0) {
      notices.push(`${withoutName} Einträge ohne Firmennamen wurden übersprungen.`);
    }

    return {
      provider: this.id,
      resolvedPlace: place.displayName,
      centerLat: place.lat,
      centerLon: place.lon,
      candidates: mapped.slice(0, query.maxResults),
      notices,
    };
  }

  /** Ortsname → Koordinaten über Nominatim. */
  private async geocode(
    city: string,
    signal?: AbortSignal,
  ): Promise<{ lat: number; lon: number; displayName: string }> {
    const url = new URL(this.nominatimEndpoint);
    url.searchParams.set("q", city);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "0");

    const body = await this.request(url.toString(), undefined, OVERPASS_LIMITS.geocodeTimeoutMs, signal);

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new DiscoveryError("Die Ortssuche hat keine verwertbare Antwort geliefert.");
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new DiscoveryError(`Der Ort „${city}" konnte nicht gefunden werden.`);
    }

    const first = parsed[0] as { lat?: string; lon?: string; display_name?: string };
    const lat = Number.parseFloat(first.lat ?? "");
    const lon = Number.parseFloat(first.lon ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new DiscoveryError(`Für „${city}" wurden keine Koordinaten geliefert.`);
    }

    return { lat, lon, displayName: first.display_name ?? city };
  }

  private async runOverpass(query: string, signal?: AbortSignal): Promise<OverpassElement[]> {
    const body = await this.request(
      this.overpassEndpoint,
      new URLSearchParams({ data: query }).toString(),
      OVERPASS_LIMITS.overpassTimeoutMs,
      signal,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new DiscoveryError("Die Datenquelle hat keine verwertbare Antwort geliefert.");
    }

    const elements = (parsed as { elements?: unknown }).elements;
    if (!Array.isArray(elements)) {
      throw new DiscoveryError("Die Antwort der Datenquelle enthielt keine Ergebnisse.");
    }

    return elements.filter(isOverpassElement);
  }

  private async request(
    url: string,
    body: string | undefined,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const response = await this.fetchImpl(url, {
        method: body === undefined ? "GET" : "POST",
        body,
        headers: {
          "user-agent": USER_AGENT,
          accept: "application/json",
          ...(body === undefined
            ? {}
            : { "content-type": "application/x-www-form-urlencoded; charset=utf-8" }),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new DiscoveryError(describeHttpFailure(response.status));
      }
      return await response.text();
    } catch (error) {
      if (error instanceof DiscoveryError) throw error;
      if (controller.signal.aborted) {
        throw new DiscoveryError(
          "Die Datenquelle hat nicht rechtzeitig geantwortet. Bitte mit kleinerem Radius erneut versuchen.",
        );
      }
      throw new DiscoveryError(
        "Die Datenquelle ist derzeit nicht erreichbar. Bitte später erneut versuchen.",
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
}

export function describeHttpFailure(status: number): string {
  if (status === 429) {
    return "Die Datenquelle hat zu viele Anfragen gemeldet (Rate Limit). Bitte einige Minuten warten.";
  }
  if (status === 504 || status === 408) {
    return "Die Abfrage war für die Datenquelle zu umfangreich. Bitte den Radius verkleinern.";
  }
  if (status >= 500) {
    return `Die Datenquelle meldet einen Serverfehler (${status}). Bitte später erneut versuchen.`;
  }
  return `Die Datenquelle hat die Anfrage abgelehnt (${status}).`;
}

function isOverpassElement(value: unknown): value is OverpassElement {
  if (typeof value !== "object" || value === null) return false;
  const element = value as Partial<OverpassElement>;
  return (
    (element.type === "node" || element.type === "way" || element.type === "relation") &&
    typeof element.id === "number"
  );
}
