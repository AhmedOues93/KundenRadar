import { describe, expect, it } from "vitest";
import { planImport } from "@/lib/discovery/import";
import type { ExistingLeadRef } from "@/lib/discovery/dedupe";
import type { DiscoveryCandidate } from "@/lib/discovery/types";

function candidate(overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    provider: "OSM_OVERPASS",
    externalId: "node/1",
    companyName: "Firma Eins",
    industry: "Handwerk",
    street: "Weg 1",
    postalCode: "10115",
    city: "Berlin",
    country: "DE",
    websiteUrl: "https://eins.de/",
    domain: "eins.de",
    phone: null,
    email: null,
    latitude: null,
    longitude: null,
    sourceUrl: null,
    raw: {},
    ...overrides,
  };
}

function selection(candidates: DiscoveryCandidate[]) {
  return candidates.map((item, index) => ({ ref: `cand-${index + 1}`, candidate: item }));
}

describe("planImport", () => {
  it("nimmt neue Treffer auf und überspringt nichts", () => {
    const plan = planImport(
      selection([
        candidate({ externalId: "node/1", companyName: "A", domain: "a.de", websiteUrl: "https://a.de" }),
        candidate({ externalId: "node/2", companyName: "B", domain: "b.de", websiteUrl: "https://b.de" }),
      ]),
      [],
    );

    expect(plan.toInsert).toHaveLength(2);
    expect(plan.toSkip).toHaveLength(0);
    expect(plan.toInsert.map((entry) => entry.ref)).toEqual(["cand-1", "cand-2"]);
  });

  it("überspringt einen Treffer, dessen Domain bereits als Lead existiert", () => {
    const existing: ExistingLeadRef[] = [
      { id: "lead-1", companyName: "Firma Eins", domain: "eins.de", street: null, postalCode: null, city: null },
    ];

    const plan = planImport(selection([candidate()]), existing);

    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toSkip).toHaveLength(1);
    expect(plan.toSkip[0]!.status).toBe("DUPLICATE_DOMAIN");
    expect(plan.toSkip[0]!.existingLeadId).toBe("lead-1");
  });

  it("überspringt einen Treffer, der über Name und Adresse bereits existiert", () => {
    const existing: ExistingLeadRef[] = [
      {
        id: "lead-2",
        companyName: "Firma Eins GmbH",
        domain: null,
        street: "Weg 1",
        postalCode: "10115",
        city: "Berlin",
      },
    ];

    const plan = planImport(
      selection([candidate({ websiteUrl: null, domain: null })]),
      existing,
    );

    expect(plan.toSkip[0]!.status).toBe("DUPLICATE_NAME_ADDRESS");
    expect(plan.toSkip[0]!.existingLeadId).toBe("lead-2");
  });

  it("importiert nur einmal, wenn die Auswahl dieselbe Firma zweimal enthält", () => {
    const plan = planImport(
      selection([
        candidate({ externalId: "node/1" }),
        candidate({ externalId: "node/2" }),
      ]),
      [],
    );

    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toSkip).toHaveLength(1);
    expect(plan.toSkip[0]!.status).toBe("DUPLICATE_IN_RESULT");
  });

  it("trennt neue und doppelte Treffer in einer gemischten Auswahl", () => {
    const existing: ExistingLeadRef[] = [
      { id: "lead-1", companyName: "X", domain: "alt.de", street: null, postalCode: null, city: null },
    ];

    const plan = planImport(
      selection([
        candidate({ externalId: "node/1", companyName: "Neu", domain: "neu.de", websiteUrl: "https://neu.de" }),
        candidate({ externalId: "node/2", companyName: "Alt", domain: "alt.de", websiteUrl: "https://alt.de" }),
        candidate({ externalId: "node/3", companyName: "Auch neu", domain: "neu2.de", websiteUrl: "https://neu2.de" }),
      ]),
      existing,
    );

    expect(plan.toInsert.map((entry) => entry.candidate.companyName)).toEqual(["Neu", "Auch neu"]);
    expect(plan.toSkip.map((entry) => entry.candidate.companyName)).toEqual(["Alt"]);
  });

  it("verarbeitet eine leere Auswahl", () => {
    const plan = planImport([], []);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toSkip).toEqual([]);
  });

  it("importiert Firmen ohne Website, wenn sie neu sind", () => {
    const plan = planImport(
      selection([candidate({ websiteUrl: null, domain: null })]),
      [],
    );
    expect(plan.toInsert).toHaveLength(1);
  });

  it("behält die Referenz auf die Eingabe bei, damit der Treffer aktualisiert werden kann", () => {
    const plan = planImport(
      selection([candidate({ externalId: "node/9", companyName: "Z", domain: "z.de", websiteUrl: "https://z.de" })]),
      [],
    );
    expect(plan.toInsert[0]!.ref).toBe("cand-1");
    expect(plan.toInsert[0]!.candidate.externalId).toBe("node/9");
  });
});

/**
 * Die Treffertabelle hat einen eindeutigen Schlüssel auf
 * (Lauf, Quelle, external_id). `startDiscovery` filtert Wiederholungen daher
 * vor dem Speichern heraus; diese Regel wird hier festgehalten.
 */
function dedupeByExternalId<T extends { candidate: DiscoveryCandidate }>(matches: T[]): T[] {
  const seen = new Set<string>();
  return matches.filter((match) => {
    if (seen.has(match.candidate.externalId)) return false;
    seen.add(match.candidate.externalId);
    return true;
  });
}

describe("Treffer vor dem Speichern entdoppeln", () => {
  it("behält je externer Kennung nur den ersten Treffer", () => {
    const matches = [
      { candidate: candidate({ externalId: "node/1", companyName: "Erst" }) },
      { candidate: candidate({ externalId: "node/1", companyName: "Wiederholung" }) },
      { candidate: candidate({ externalId: "way/2", companyName: "Zweit" }) },
    ];

    const result = dedupeByExternalId(matches);
    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.candidate.companyName)).toEqual(["Erst", "Zweit"]);
  });

  it("lässt eindeutige Treffer unverändert", () => {
    const matches = [
      { candidate: candidate({ externalId: "node/1" }) },
      { candidate: candidate({ externalId: "node/2" }) },
    ];
    expect(dedupeByExternalId(matches)).toHaveLength(2);
  });
});
