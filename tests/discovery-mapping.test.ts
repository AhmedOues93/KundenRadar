import { describe, expect, it } from "vitest";
import {
  buildOverpassQuery,
  isSocialOnly,
  mapOverpassElement,
  mapOverpassElements,
  pickWebsite,
  type OverpassElement,
} from "@/lib/discovery/osm-mapping";
import { findIndustry, INDUSTRIES, isIndustryKey } from "@/lib/discovery/industries";

const elektriker = findIndustry("elektriker")!;

function node(tags: Record<string, string>, id = 1): OverpassElement {
  return { type: "node", id, lat: 50.94, lon: 6.96, tags };
}

describe("Branchenkatalog", () => {
  it("enthält die geforderten Branchen", () => {
    for (const key of [
      "handwerk",
      "elektriker",
      "sanitaer",
      "dachdecker",
      "maler",
      "restaurants",
      "hotels",
      "aerzte",
      "immobilien",
      "pflege",
      "rechtsanwaelte",
      "steuerberater",
    ]) {
      expect(isIndustryKey(key), key).toBe(true);
    }
  });

  it("hat eindeutige Schlüssel und je mindestens einen OSM-Selektor", () => {
    const keys = INDUSTRIES.map((industry) => industry.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const industry of INDUSTRIES) {
      expect(industry.osm.length, industry.key).toBeGreaterThan(0);
      expect(industry.leadIndustry.length, industry.key).toBeGreaterThan(0);
    }
  });
});

describe("buildOverpassQuery", () => {
  const query = buildOverpassQuery({
    selectors: elektriker.osm,
    lat: 50.938361,
    lon: 6.959974,
    radiusMeters: 10_000,
    maxResults: 150,
    timeoutSeconds: 40,
  });

  it("setzt Ausgabeformat und Timeout", () => {
    expect(query.startsWith("[out:json][timeout:40];")).toBe(true);
  });

  it("fragt Node, Way und Relation ab", () => {
    expect(query).toContain("node[");
    expect(query).toContain("way[");
    expect(query).toContain("relation[");
  });

  it("begrenzt Umkreis und Trefferzahl", () => {
    expect(query).toContain("(around:10000,50.938361,6.959974)");
    expect(query).toContain("out center 150;");
  });

  it("baut aus mehreren Werten eine Alternative", () => {
    expect(query).toMatch(/\["craft"~"\^\(electrician\|electronics_repair\)\$"\]/);
  });

  it("nutzt bei einem einzelnen Wert die Gleichheit", () => {
    const single = buildOverpassQuery({
      selectors: [{ key: "craft", values: ["roofer"] }],
      lat: 1,
      lon: 2,
      radiusMeters: 500,
      maxResults: 10,
      timeoutSeconds: 5,
    });
    expect(single).toContain('["craft"="roofer"]');
  });

  it("prüft nur auf Vorhandensein, wenn keine Werte angegeben sind", () => {
    const anyCraft = buildOverpassQuery({
      selectors: [{ key: "craft", values: [] }],
      lat: 1,
      lon: 2,
      radiusMeters: 500,
      maxResults: 10,
      timeoutSeconds: 5,
    });
    expect(anyCraft).toContain('["craft"]');
  });

  it("weist manipulierte Selektoren ab", () => {
    for (const selector of [
      { key: 'craft"];out;//', values: [] },
      { key: "craft", values: ['electrician"];out meta;//'] },
      { key: "craft ", values: [] },
    ]) {
      expect(() =>
        buildOverpassQuery({
          selectors: [selector],
          lat: 1,
          lon: 2,
          radiusMeters: 100,
          maxResults: 5,
          timeoutSeconds: 5,
        }),
      ).toThrow();
    }
  });

  it("wirft ohne Selektoren", () => {
    expect(() =>
      buildOverpassQuery({
        selectors: [],
        lat: 1,
        lon: 2,
        radiusMeters: 100,
        maxResults: 5,
        timeoutSeconds: 5,
      }),
    ).toThrow();
  });
});

describe("mapOverpassElement", () => {
  it("übernimmt Name, Adresse, Website, Telefon und Quelle", () => {
    const candidate = mapOverpassElement(
      node(
        {
          name: "Elektro Meier GmbH",
          "addr:street": "Hauptstraße",
          "addr:housenumber": "12a",
          "addr:postcode": "50667",
          "addr:city": "Köln",
          "addr:country": "DE",
          website: "https://elektro-meier.de/start",
          phone: "+49 221 123456",
          email: "info@elektro-meier.de",
        },
        4711,
      ),
      elektriker,
    );

    expect(candidate).not.toBeNull();
    expect(candidate!.companyName).toBe("Elektro Meier GmbH");
    expect(candidate!.street).toBe("Hauptstraße 12a");
    expect(candidate!.postalCode).toBe("50667");
    expect(candidate!.city).toBe("Köln");
    expect(candidate!.country).toBe("DE");
    expect(candidate!.websiteUrl).toBe("https://elektro-meier.de/start");
    expect(candidate!.domain).toBe("elektro-meier.de");
    expect(candidate!.phone).toBe("+49 221 123456");
    expect(candidate!.email).toBe("info@elektro-meier.de");
    expect(candidate!.industry).toBe("Elektrotechnik");
    expect(candidate!.externalId).toBe("node/4711");
    expect(candidate!.sourceUrl).toBe("https://www.openstreetmap.org/node/4711");
    expect(candidate!.latitude).toBe(50.94);
  });

  it("verwirft Einträge ohne Namen", () => {
    expect(mapOverpassElement(node({ "addr:city": "Köln" }), elektriker)).toBeNull();
  });

  it("weicht auf official_name, operator und brand aus", () => {
    expect(mapOverpassElement(node({ official_name: "Amt" }), elektriker)?.companyName).toBe("Amt");
    expect(mapOverpassElement(node({ operator: "Betreiber" }), elektriker)?.companyName).toBe(
      "Betreiber",
    );
    expect(mapOverpassElement(node({ brand: "Marke" }), elektriker)?.companyName).toBe("Marke");
  });

  it("ergänzt eine Website ohne Schema", () => {
    const candidate = mapOverpassElement(node({ name: "A", website: "beispiel.de" }), elektriker);
    expect(candidate!.websiteUrl).toBe("https://beispiel.de/");
    expect(candidate!.domain).toBe("beispiel.de");
  });

  it("entfernt www. aus der Domain", () => {
    const candidate = mapOverpassElement(
      node({ name: "A", website: "https://www.Beispiel.DE/" }),
      elektriker,
    );
    expect(candidate!.domain).toBe("beispiel.de");
  });

  it("nimmt bei Mehrfachwerten den ersten", () => {
    const candidate = mapOverpassElement(
      node({ name: "A", website: "https://eins.de;https://zwei.de" }),
      elektriker,
    );
    expect(candidate!.domain).toBe("eins.de");
  });

  it("lässt Firmen ohne Website zu, markiert sie aber als solche", () => {
    const candidate = mapOverpassElement(node({ name: "Ohne Web" }), elektriker);
    expect(candidate!.websiteUrl).toBeNull();
    expect(candidate!.domain).toBeNull();
  });

  it("nutzt den Mittelpunkt von Ways", () => {
    const candidate = mapOverpassElement(
      { type: "way", id: 9, center: { lat: 1.5, lon: 2.5 }, tags: { name: "W" } },
      elektriker,
    );
    expect(candidate!.latitude).toBe(1.5);
    expect(candidate!.longitude).toBe(2.5);
    expect(candidate!.externalId).toBe("way/9");
  });

  it("verwirft unplausible E-Mail-Adressen", () => {
    expect(mapOverpassElement(node({ name: "A", email: "kein-mail" }), elektriker)?.email).toBeNull();
  });

  it("kürzt überlange Firmennamen", () => {
    const candidate = mapOverpassElement(node({ name: "x".repeat(400) }), elektriker);
    expect(candidate!.companyName.length).toBe(200);
  });
});

describe("pickWebsite", () => {
  it("berücksichtigt alternative Tags", () => {
    expect(pickWebsite({ "contact:website": "https://a.de" }).domain).toBe("a.de");
    expect(pickWebsite({ url: "https://b.de" }).domain).toBe("b.de");
  });

  it("überspringt Social-Media-Profile", () => {
    expect(pickWebsite({ website: "https://www.facebook.com/firma" }).url).toBeNull();
    expect(pickWebsite({ website: "https://instagram.com/firma" }).url).toBeNull();
  });

  it("nimmt die echte Website, wenn zusätzlich Social hinterlegt ist", () => {
    expect(
      pickWebsite({ website: "https://facebook.com/x", "contact:website": "https://echt.de" })
        .domain,
    ).toBe("echt.de");
  });

  it("verwirft Adressen, die die SSRF-Normalisierung ablehnt", () => {
    expect(pickWebsite({ website: "file:///etc/passwd" }).url).toBeNull();
    expect(pickWebsite({ website: "javascript:alert(1)" }).url).toBeNull();
  });

  it("erkennt Social-Hosts", () => {
    expect(isSocialOnly("https://www.linkedin.com/company/x")).toBe(true);
    expect(isSocialOnly("https://eigene-firma.de")).toBe(false);
  });
});

describe("mapOverpassElements", () => {
  it("überspringt unbrauchbare Einträge, ohne abzubrechen", () => {
    const mapped = mapOverpassElements(
      [node({ name: "Eins" }, 1), node({}, 2), node({ name: "Zwei" }, 3)],
      elektriker,
    );
    expect(mapped.map((candidate) => candidate.companyName)).toEqual(["Eins", "Zwei"]);
  });
});
