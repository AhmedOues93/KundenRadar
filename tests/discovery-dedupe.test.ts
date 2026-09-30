import { describe, expect, it } from "vitest";
import {
  classifyCandidates,
  isWorthImporting,
  nameAddressKey,
  normalizeAddress,
  normalizeCompanyName,
  normalizeDomain,
  type ExistingLeadRef,
} from "@/lib/discovery/dedupe";
import { candidateToLeadRow } from "@/lib/discovery/import";
import type { DiscoveryCandidate } from "@/lib/discovery/types";

function candidate(overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    provider: "OSM_OVERPASS",
    externalId: "node/1",
    companyName: "Elektro Meier GmbH",
    industry: "Elektrotechnik",
    street: "Hauptstraße 12",
    postalCode: "50667",
    city: "Köln",
    country: "DE",
    websiteUrl: "https://elektro-meier.de/",
    domain: "elektro-meier.de",
    phone: null,
    email: null,
    latitude: null,
    longitude: null,
    sourceUrl: "https://www.openstreetmap.org/node/1",
    raw: {},
    ...overrides,
  };
}

function lead(overrides: Partial<ExistingLeadRef> = {}): ExistingLeadRef {
  return {
    id: "lead-1",
    companyName: "Elektro Meier GmbH",
    domain: "elektro-meier.de",
    street: "Hauptstraße 12",
    postalCode: "50667",
    city: "Köln",
    ...overrides,
  };
}

describe("normalizeDomain", () => {
  it("vereinheitlicht Schreibweisen", () => {
    expect(normalizeDomain("https://WWW.Beispiel.DE/pfad?x=1")).toBe("beispiel.de");
    expect(normalizeDomain("beispiel.de.")).toBe("beispiel.de");
    expect(normalizeDomain("  ")).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
  });
});

describe("normalizeCompanyName", () => {
  it("entfernt Rechtsformen und Satzzeichen", () => {
    expect(normalizeCompanyName("Elektro Meier GmbH")).toBe("elektro meier");
    expect(normalizeCompanyName("Elektro-Meier GmbH & Co. KG")).toBe("elektro meier");
    expect(normalizeCompanyName("Elektro Meier e.K.")).toBe("elektro meier");
    expect(normalizeCompanyName("Elektro Meier AG")).toBe("elektro meier");
  });

  it("löst Umlaute auf", () => {
    expect(normalizeCompanyName("Bäckerei Müller")).toBe("baeckerei mueller");
    expect(normalizeCompanyName("Straßen GmbH")).toBe("strassen");
  });

  it("liefert für leere Eingaben einen leeren Schlüssel", () => {
    expect(normalizeCompanyName(null)).toBe("");
    expect(normalizeCompanyName("   ")).toBe("");
  });
});

describe("normalizeAddress", () => {
  it("vereinheitlicht Strassenschreibweisen", () => {
    const a = normalizeAddress({ street: "Hauptstraße 12", postalCode: "50667", city: "Köln" });
    const b = normalizeAddress({ street: "Hauptstr. 12", postalCode: "50667", city: "Koeln" });
    const c = normalizeAddress({ street: "Hauptstrasse 12", postalCode: "50667", city: "KÖLN" });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("ist leer, wenn keine Angaben vorliegen", () => {
    expect(normalizeAddress({ street: null, postalCode: null, city: null })).toBe("");
  });
});

describe("nameAddressKey", () => {
  it("liefert ohne Ortsangabe keinen Schlüssel", () => {
    expect(
      nameAddressKey({ companyName: "Firma", street: null, postalCode: null, city: null }),
    ).toBeNull();
  });

  it("liefert ohne Namen keinen Schlüssel", () => {
    expect(
      nameAddressKey({ companyName: "", street: "Weg 1", postalCode: "12345", city: "Ort" }),
    ).toBeNull();
  });
});

describe("classifyCandidates", () => {
  it("markiert neue Firmen als NEW", () => {
    const [match] = classifyCandidates([candidate()], []);
    expect(match!.status).toBe("NEW");
    expect(match!.existingLeadId).toBeNull();
  });

  it("erkennt ein Duplikat über die Domain", () => {
    const [match] = classifyCandidates([candidate()], [lead({ id: "vorhanden" })]);
    expect(match!.status).toBe("DUPLICATE_DOMAIN");
    expect(match!.existingLeadId).toBe("vorhanden");
  });

  it("erkennt die Domain auch bei abweichender Schreibweise", () => {
    const [match] = classifyCandidates(
      [candidate({ domain: null, websiteUrl: "http://WWW.Elektro-Meier.de/kontakt" })],
      [lead()],
    );
    expect(match!.status).toBe("DUPLICATE_DOMAIN");
  });

  it("erkennt ein Duplikat über Name und Adresse ohne Website", () => {
    const [match] = classifyCandidates(
      [candidate({ websiteUrl: null, domain: null })],
      [lead({ id: "vorhanden", domain: null, companyName: "Elektro-Meier GmbH & Co. KG" })],
    );
    expect(match!.status).toBe("DUPLICATE_NAME_ADDRESS");
    expect(match!.existingLeadId).toBe("vorhanden");
  });

  it("hält gleiche Namen an verschiedenen Adressen auseinander", () => {
    const [match] = classifyCandidates(
      [candidate({ websiteUrl: null, domain: null, street: "Nebenweg 3", postalCode: "80331", city: "München" })],
      [lead({ domain: null })],
    );
    expect(match!.status).toBe("NEW");
  });

  it("erkennt Dubletten innerhalb einer Ergebnisliste", () => {
    const matches = classifyCandidates(
      [candidate({ externalId: "node/1" }), candidate({ externalId: "node/2" })],
      [],
    );
    expect(matches[0]!.status).toBe("NEW");
    expect(matches[1]!.status).toBe("DUPLICATE_IN_RESULT");
  });

  it("erkennt denselben externen Datensatz zweimal", () => {
    const matches = classifyCandidates([candidate(), candidate()], []);
    expect(matches[1]!.status).toBe("DUPLICATE_IN_RESULT");
  });

  it("behält die Reihenfolge der Eingabe", () => {
    const matches = classifyCandidates(
      [
        candidate({ externalId: "node/1", companyName: "A", domain: "a.de", websiteUrl: "https://a.de" }),
        candidate({ externalId: "node/2", companyName: "B", domain: "b.de", websiteUrl: "https://b.de" }),
        candidate({ externalId: "node/3", companyName: "C", domain: "c.de", websiteUrl: "https://c.de" }),
      ],
      [],
    );
    expect(matches.map((match) => match.candidate.companyName)).toEqual(["A", "B", "C"]);
  });

  it("verarbeitet eine leere Eingabe", () => {
    expect(classifyCandidates([], [lead()])).toEqual([]);
  });

  it("ignoriert bestehende Leads ohne verwertbare Schlüssel", () => {
    const [match] = classifyCandidates(
      [candidate()],
      [{ id: "x", companyName: "", domain: null, street: null, postalCode: null, city: null }],
    );
    expect(match!.status).toBe("NEW");
  });
});

describe("isWorthImporting", () => {
  it("gilt nur für neue Firmen mit Website", () => {
    expect(isWorthImporting({ candidate: candidate(), status: "NEW", existingLeadId: null })).toBe(true);
    expect(
      isWorthImporting({
        candidate: candidate({ websiteUrl: null }),
        status: "NEW",
        existingLeadId: null,
      }),
    ).toBe(false);
    expect(
      isWorthImporting({ candidate: candidate(), status: "DUPLICATE_DOMAIN", existingLeadId: "x" }),
    ).toBe(false);
  });
});

describe("candidateToLeadRow", () => {
  const context = { organizationId: "org-1", userId: "user-1" };

  it("bildet einen Treffer auf eine Lead-Zeile ab", () => {
    const row = candidateToLeadRow(candidate(), context);
    expect(row).toMatchObject({
      organization_id: "org-1",
      company_name: "Elektro Meier GmbH",
      website_url: "https://elektro-meier.de/",
      domain: "elektro-meier.de",
      street: "Hauptstraße 12",
      postal_code: "50667",
      city: "Köln",
      industry: "Elektrotechnik",
      source: "DISCOVERY",
      status: "NEW",
      created_by: "user-1",
    });
  });

  it("setzt leere Angaben auf null", () => {
    const row = candidateToLeadRow(
      candidate({ street: "   ", city: null, industry: null, phone: "" }),
      context,
    );
    expect(row.street).toBeNull();
    expect(row.city).toBeNull();
    expect(row.industry).toBeNull();
    expect(row.phone).toBeNull();
  });

  it("kürzt überlange Werte auf die Spaltenbreite", () => {
    const row = candidateToLeadRow(
      candidate({ companyName: "x".repeat(300), street: "y".repeat(300) }),
      context,
    );
    expect(row.company_name.length).toBe(200);
    expect(row.street!.length).toBe(200);
  });

  it("liefert auch bei leerem Namen einen Firmennamen", () => {
    const row = candidateToLeadRow(candidate({ companyName: "   " }), context);
    expect(row.company_name).toBe("Unbenannte Firma");
  });
});
