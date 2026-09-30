import { normalizeUrl } from "@/lib/analysis/url-guard";
import type { DiscoveryCandidate } from "./types";
import type { IndustryDefinition, OsmSelector } from "./industries";

/**
 * Abbildung von OpenStreetMap-Elementen auf Discovery-Treffer.
 *
 * Bewusst netzwerkfrei und ohne Seiteneffekte, damit die Abbildung vollständig
 * testbar ist.
 */

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** Baut eine Overpass-QL-Abfrage für einen Umkreis. */
export function buildOverpassQuery(input: {
  selectors: OsmSelector[];
  lat: number;
  lon: number;
  radiusMeters: number;
  maxResults: number;
  timeoutSeconds: number;
}): string {
  const { lat, lon, radiusMeters, maxResults, timeoutSeconds } = input;
  const around = `(around:${round(radiusMeters, 0)},${round(lat, 6)},${round(lon, 6)})`;

  const statements: string[] = [];
  for (const selector of input.selectors) {
    const filter = selectorToFilter(selector);
    // Firmen sind in OSM als Node, Way oder Relation erfasst.
    for (const type of ["node", "way", "relation"] as const) {
      statements.push(`  ${type}${filter}${around};`);
    }
  }

  if (statements.length === 0) {
    throw new Error("Für diese Branche ist keine Abfrage definiert.");
  }

  // `out center` liefert für Ways/Relations einen Mittelpunkt statt aller Knoten.
  return [
    `[out:json][timeout:${Math.round(timeoutSeconds)}];`,
    "(",
    ...statements,
    ");",
    `out center ${Math.round(maxResults)};`,
  ].join("\n");
}

/**
 * Baut den Tag-Filter. Schlüssel und Werte stammen ausschliesslich aus dem
 * Branchenkatalog im Code – nie aus Benutzereingaben. Zusätzlich wird streng
 * validiert, damit die Abfrage auch bei einem Fehler im Katalog nicht
 * manipulierbar ist.
 */
function selectorToFilter(selector: OsmSelector): string {
  const key = assertSafeToken(selector.key, "OSM-Key");
  if (selector.values.length === 0) return `["${key}"]`;
  const values = selector.values.map((value) => assertSafeToken(value, "OSM-Wert"));
  if (values.length === 1) return `["${key}"="${values[0]}"]`;
  return `["${key}"~"^(${values.join("|")})$"]`;
}

const SAFE_TOKEN = /^[a-z0-9_:-]+$/i;

function assertSafeToken(value: string, what: string): string {
  if (!SAFE_TOKEN.test(value)) {
    throw new Error(`Unzulässiger ${what}: ${value}`);
  }
  return value;
}

/**
 * Wandelt ein Overpass-Element in einen Treffer um. Gibt `null` zurück, wenn
 * der Datensatz für die Akquise unbrauchbar ist (z. B. ohne Namen).
 */
export function mapOverpassElement(
  element: OverpassElement,
  industry: IndustryDefinition,
): DiscoveryCandidate | null {
  const tags = element.tags ?? {};
  const companyName = pickName(tags);
  if (!companyName) return null;

  const website = pickWebsite(tags);
  const coordinates = pickCoordinates(element);

  return {
    provider: "OSM_OVERPASS",
    externalId: `${element.type}/${element.id}`,
    companyName,
    industry: industry.leadIndustry,
    street: pickStreet(tags),
    postalCode: cleanTag(tags["addr:postcode"]),
    city: cleanTag(tags["addr:city"]) ?? cleanTag(tags["addr:suburb"]),
    country: cleanTag(tags["addr:country"]),
    websiteUrl: website.url,
    domain: website.domain,
    phone: pickPhone(tags),
    email: pickEmail(tags),
    latitude: coordinates?.lat ?? null,
    longitude: coordinates?.lon ?? null,
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    raw: { type: element.type, id: element.id, tags },
  };
}

export function mapOverpassElements(
  elements: OverpassElement[],
  industry: IndustryDefinition,
): DiscoveryCandidate[] {
  const candidates: DiscoveryCandidate[] = [];
  for (const element of elements) {
    const candidate = mapOverpassElement(element, industry);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

function pickName(tags: Record<string, string>): string | null {
  const name =
    cleanTag(tags["name"]) ??
    cleanTag(tags["official_name"]) ??
    cleanTag(tags["operator"]) ??
    cleanTag(tags["brand"]);
  if (!name) return null;
  return name.length > 200 ? name.slice(0, 200) : name;
}

function pickStreet(tags: Record<string, string>): string | null {
  const street = cleanTag(tags["addr:street"]);
  if (!street) return cleanTag(tags["addr:place"]);
  const number = cleanTag(tags["addr:housenumber"]);
  return number ? `${street} ${number}` : street;
}

/**
 * Website aus den üblichen Tags. Die URL wird über die bestehende
 * Normalisierung geführt; alles, was dort abgelehnt wird (etwa eine
 * `file:`-Adresse oder ein interner Hostname), wird verworfen.
 */
export function pickWebsite(tags: Record<string, string>): {
  url: string | null;
  domain: string | null;
} {
  const candidates = [
    tags["website"],
    tags["contact:website"],
    tags["url"],
    tags["website:official"],
  ];

  for (const raw of candidates) {
    const value = cleanTag(raw);
    if (!value) continue;
    // Mehrfachwerte in OSM sind mit „;" getrennt.
    const first = value.split(";")[0]?.trim();
    if (!first) continue;
    // Social-Media-Profile sind für eine Website-Analyse nicht brauchbar.
    if (isSocialOnly(first)) continue;
    try {
      const url = normalizeUrl(first);
      return { url: url.toString(), domain: url.hostname.replace(/^www\./, "").toLowerCase() };
    } catch {
      continue;
    }
  }

  return { url: null, domain: null };
}

const SOCIAL_HOSTS = [
  "facebook.com",
  "fb.me",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "wa.me",
  "t.me",
  "xing.com",
  "google.com",
  "goo.gl",
  "maps.app.goo.gl",
];

export function isSocialOnly(value: string): boolean {
  const lower = value.toLowerCase();
  return SOCIAL_HOSTS.some(
    (host) => lower.includes(`//${host}`) || lower.includes(`//www.${host}`) || lower.startsWith(host),
  );
}

function pickPhone(tags: Record<string, string>): string | null {
  const phone =
    cleanTag(tags["phone"]) ??
    cleanTag(tags["contact:phone"]) ??
    cleanTag(tags["contact:mobile"]);
  if (!phone) return null;
  const first = phone.split(";")[0]?.trim() ?? null;
  return first && first.length <= 60 ? first : null;
}

function pickEmail(tags: Record<string, string>): string | null {
  const email = cleanTag(tags["email"]) ?? cleanTag(tags["contact:email"]);
  if (!email) return null;
  const first = email.split(";")[0]?.trim() ?? "";
  // Nur plausible Adressen übernehmen, damit die Lead-Validierung nicht bricht.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(first) ? first : null;
}

function pickCoordinates(element: OverpassElement): { lat: number; lon: number } | null {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center) return { lat: element.center.lat, lon: element.center.lon };
  return null;
}

function cleanTag(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function round(value: number, digits: number): string {
  return value.toFixed(digits);
}
