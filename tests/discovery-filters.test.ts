import { describe, expect, it } from "vitest";
import { DISCOVERY_LIMITS, MAX_RESULT_OPTIONS, RADIUS_OPTIONS } from "@/lib/discovery/industries";
import { MATCH_STATUS_LABELS, providerLabel } from "@/lib/discovery/labels";
import { MATCH_STATUSES, type MatchStatus } from "@/lib/discovery/types";
import { findImprintUrl, preferAgencyHint } from "@/lib/analysis/agency";
import type { AgencyHint } from "@/lib/types";

/**
 * Die Filterlogik der Trefferliste, gespiegelt aus `discovery-results.tsx`.
 * Beide Stellen benennen dieselben Fälle; hier wird das Verhalten festgehalten.
 */
type Row = { match_status: MatchStatus; website_url: string | null; imported_lead_id: string | null };
type Filter = "SENSIBLE" | "NEW" | "WITH_WEBSITE" | "WITHOUT_WEBSITE" | "DUPLICATE" | "ALL";

function isSensible(row: Row): boolean {
  return row.match_status === "NEW" && Boolean(row.website_url) && !row.imported_lead_id;
}

function matchesFilter(row: Row, filter: Filter): boolean {
  switch (filter) {
    case "SENSIBLE":
      return isSensible(row);
    case "NEW":
      return row.match_status === "NEW";
    case "WITH_WEBSITE":
      return Boolean(row.website_url);
    case "WITHOUT_WEBSITE":
      return !row.website_url;
    case "DUPLICATE":
      return row.match_status !== "NEW";
    case "ALL":
      return true;
  }
}

const ROWS: Row[] = [
  { match_status: "NEW", website_url: "https://a.de", imported_lead_id: null },
  { match_status: "NEW", website_url: null, imported_lead_id: null },
  { match_status: "NEW", website_url: "https://c.de", imported_lead_id: "lead-c" },
  { match_status: "DUPLICATE_DOMAIN", website_url: "https://d.de", imported_lead_id: null },
  { match_status: "DUPLICATE_NAME_ADDRESS", website_url: null, imported_lead_id: null },
  { match_status: "DUPLICATE_IN_RESULT", website_url: "https://f.de", imported_lead_id: null },
];

function count(filter: Filter): number {
  return ROWS.filter((row) => matchesFilter(row, filter)).length;
}

describe("Discovery-Filter", () => {
  it("zeigt als sinnvoll nur neue, nicht importierte Treffer mit Website", () => {
    expect(count("SENSIBLE")).toBe(1);
  });

  it("zeigt unter NEU auch Treffer ohne Website und bereits importierte", () => {
    expect(count("NEW")).toBe(3);
  });

  it("trennt mit und ohne Website vollständig", () => {
    expect(count("WITH_WEBSITE") + count("WITHOUT_WEBSITE")).toBe(ROWS.length);
    expect(count("WITHOUT_WEBSITE")).toBe(2);
  });

  it("zeigt unter Duplikaten alle Nicht-NEU-Zustände", () => {
    expect(count("DUPLICATE")).toBe(3);
  });

  it("zeigt unter ALLE jeden Treffer", () => {
    expect(count("ALL")).toBe(ROWS.length);
  });

  it("überschneidet sich nicht zwischen NEU und Duplikaten", () => {
    expect(count("NEW") + count("DUPLICATE")).toBe(ROWS.length);
  });
});

describe("Beschriftungen", () => {
  it("benennt jeden Abgleichstatus", () => {
    for (const status of MATCH_STATUSES) {
      expect(MATCH_STATUS_LABELS[status], status).toBeTruthy();
    }
  });

  it("nennt keine Duplikatmeldung eine Bewertung", () => {
    for (const status of MATCH_STATUSES) {
      expect(MATCH_STATUS_LABELS[status].toLowerCase()).not.toContain("kunde");
    }
  });

  it("gibt bei unbekanntem Provider den Rohwert zurück", () => {
    expect(providerLabel("OSM_OVERPASS")).toBe("OpenStreetMap");
    expect(providerLabel("ANDERE_QUELLE")).toBe("ANDERE_QUELLE");
  });
});

describe("Suchparameter", () => {
  it("hält die Auswahlmöglichkeiten innerhalb der Grenzen", () => {
    for (const radius of RADIUS_OPTIONS) {
      expect(radius).toBeGreaterThanOrEqual(DISCOVERY_LIMITS.minRadiusKm);
      expect(radius).toBeLessThanOrEqual(DISCOVERY_LIMITS.maxRadiusKm);
    }
    for (const max of MAX_RESULT_OPTIONS) {
      expect(max).toBeGreaterThanOrEqual(DISCOVERY_LIMITS.minResults);
      expect(max).toBeLessThanOrEqual(DISCOVERY_LIMITS.maxResults);
    }
  });
});

describe("findImprintUrl", () => {
  it("findet die Impressum-Seite unter den internen Links", () => {
    expect(
      findImprintUrl([
        "https://kunde.de/leistungen",
        "https://kunde.de/impressum",
        "https://kunde.de/kontakt",
      ]),
    ).toBe("https://kunde.de/impressum");
  });

  it("erkennt englische und alternative Schreibweisen", () => {
    expect(findImprintUrl(["https://kunde.de/imprint"])).toBe("https://kunde.de/imprint");
    expect(findImprintUrl(["https://kunde.de/legal-notice"])).toBe("https://kunde.de/legal-notice");
    expect(findImprintUrl(["https://kunde.de/de/impressum.html"])).toBe(
      "https://kunde.de/de/impressum.html",
    );
  });

  it("liefert null, wenn es keine Impressum-Seite gibt", () => {
    expect(findImprintUrl(["https://kunde.de/", "https://kunde.de/team"])).toBeNull();
    expect(findImprintUrl([])).toBeNull();
  });

  it("überspringt ungültige Adressen", () => {
    expect(findImprintUrl(["kein-url", "https://kunde.de/impressum"])).toBe(
      "https://kunde.de/impressum",
    );
  });
});

describe("preferAgencyHint", () => {
  const nothing: AgencyHint = {
    found: false,
    agencyName: null,
    evidence: null,
    sourceUrl: null,
    location: null,
  };
  const withoutName: AgencyHint = {
    found: true,
    agencyName: null,
    evidence: "Webdesign",
    sourceUrl: "https://kunde.de/",
    location: "footer",
  };
  const withName: AgencyHint = {
    found: true,
    agencyName: "Agentur Beispiel",
    evidence: "Website by Agentur Beispiel",
    sourceUrl: "https://kunde.de/impressum",
    location: "impressum/footer",
  };

  it("zieht einen Treffer einem Nicht-Treffer vor", () => {
    expect(preferAgencyHint(nothing, withName)).toBe(withName);
  });

  it("zieht einen Treffer mit Namen einem ohne Namen vor", () => {
    expect(preferAgencyHint(withoutName, withName)).toBe(withName);
  });

  it("behält den ersten Treffer, wenn beide einen Namen haben", () => {
    expect(preferAgencyHint(withName, withoutName)).toBe(withName);
  });

  it("kommt mit fehlenden Werten zurecht", () => {
    expect(preferAgencyHint(null, null)).toBeNull();
    expect(preferAgencyHint(null, withName)).toBe(withName);
    expect(preferAgencyHint(nothing, null)).toBe(nothing);
  });
});
