/**
 * Branchenkatalog.
 *
 * Jeder Eintrag bringt seine eigene Abbildung auf OpenStreetMap-Tags mit.
 * Kommt später eine weitere Datenquelle hinzu, erhält der Eintrag ein
 * zusätzliches Feld – die Oberfläche bleibt unverändert.
 */

export type OsmSelector = {
  /** OSM-Key, z. B. `craft`, `shop`, `amenity`, `office`, `healthcare`. */
  key: string;
  /** Erlaubte Werte. Leer bedeutet: Key muss lediglich vorhanden sein. */
  values: string[];
};

export type IndustryDefinition = {
  /** Stabiler Schlüssel, erscheint in URLs und in der Datenbank. */
  key: string;
  label: string;
  /** Wird als Branche am Lead gespeichert. */
  leadIndustry: string;
  osm: OsmSelector[];
};

export const INDUSTRIES: IndustryDefinition[] = [
  {
    key: "handwerk",
    label: "Handwerk (allgemein)",
    leadIndustry: "Handwerk",
    osm: [{ key: "craft", values: [] }],
  },
  {
    key: "elektriker",
    label: "Elektriker",
    leadIndustry: "Elektrotechnik",
    osm: [{ key: "craft", values: ["electrician", "electronics_repair"] }],
  },
  {
    key: "sanitaer",
    label: "Sanitär & Heizung",
    leadIndustry: "Sanitär und Heizung",
    osm: [{ key: "craft", values: ["plumber", "hvac", "heating_engineer"] }],
  },
  {
    key: "dachdecker",
    label: "Dachdecker",
    leadIndustry: "Dachdecker",
    osm: [{ key: "craft", values: ["roofer"] }],
  },
  {
    key: "maler",
    label: "Maler & Lackierer",
    leadIndustry: "Maler und Lackierer",
    osm: [{ key: "craft", values: ["painter", "plasterer"] }],
  },
  {
    key: "tischler",
    label: "Tischler & Schreiner",
    leadIndustry: "Tischlerei",
    osm: [{ key: "craft", values: ["carpenter", "joiner", "cabinet_maker"] }],
  },
  {
    key: "restaurants",
    label: "Restaurants",
    leadIndustry: "Gastronomie",
    osm: [{ key: "amenity", values: ["restaurant", "cafe", "bar", "fast_food"] }],
  },
  {
    key: "hotels",
    label: "Hotels & Pensionen",
    leadIndustry: "Hotellerie",
    osm: [{ key: "tourism", values: ["hotel", "guest_house", "apartment", "hostel"] }],
  },
  {
    key: "aerzte",
    label: "Ärzte",
    leadIndustry: "Arztpraxis",
    osm: [
      { key: "amenity", values: ["doctors", "clinic"] },
      { key: "healthcare", values: ["doctor", "centre"] },
    ],
  },
  {
    key: "zahnaerzte",
    label: "Zahnärzte",
    leadIndustry: "Zahnarztpraxis",
    osm: [
      { key: "amenity", values: ["dentist"] },
      { key: "healthcare", values: ["dentist"] },
    ],
  },
  {
    key: "immobilien",
    label: "Immobilien",
    leadIndustry: "Immobilien",
    osm: [{ key: "office", values: ["estate_agent"] }],
  },
  {
    key: "pflege",
    label: "Pflege & Betreuung",
    leadIndustry: "Pflege",
    osm: [
      { key: "amenity", values: ["nursing_home", "social_facility"] },
      { key: "healthcare", values: ["nurse", "physiotherapist"] },
    ],
  },
  {
    key: "rechtsanwaelte",
    label: "Rechtsanwälte",
    leadIndustry: "Rechtsanwälte",
    osm: [{ key: "office", values: ["lawyer"] }],
  },
  {
    key: "steuerberater",
    label: "Steuerberater",
    leadIndustry: "Steuerberatung",
    osm: [
      { key: "office", values: ["tax_advisor", "accountant"] },
      { key: "amenity", values: ["tax_advisor"] },
    ],
  },
  {
    key: "autohaus",
    label: "Autohäuser & Werkstätten",
    leadIndustry: "Kfz-Gewerbe",
    osm: [
      { key: "shop", values: ["car", "car_repair", "motorcycle"] },
      { key: "craft", values: ["car_repair"] },
    ],
  },
  {
    key: "friseur",
    label: "Friseure & Kosmetik",
    leadIndustry: "Friseur und Kosmetik",
    osm: [{ key: "shop", values: ["hairdresser", "beauty"] }],
  },
];

const BY_KEY = new Map(INDUSTRIES.map((industry) => [industry.key, industry]));

export function findIndustry(key: string): IndustryDefinition | null {
  return BY_KEY.get(key) ?? null;
}

export function isIndustryKey(key: string): boolean {
  return BY_KEY.has(key);
}

/** Auswahlmöglichkeiten für den Radius in Kilometern. */
export const RADIUS_OPTIONS = [5, 10, 15, 25, 40, 50] as const;

/** Auswahlmöglichkeiten für die maximale Trefferzahl. */
export const MAX_RESULT_OPTIONS = [25, 50, 100, 150] as const;

export const DISCOVERY_LIMITS = {
  minRadiusKm: 1,
  maxRadiusKm: 50,
  minResults: 1,
  maxResults: 200,
} as const;
