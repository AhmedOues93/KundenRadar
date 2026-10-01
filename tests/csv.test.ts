import { describe, expect, it } from "vitest";
import {
  buildCsv,
  isDangerousCsvValue,
  csvBoolean,
  csvDate,
  csvFilename,
  csvNumber,
  escapeCsvValue,
  UTF8_BOM,
} from "@/lib/csv";

describe("escapeCsvValue", () => {
  it("lässt einfache Werte unverändert", () => {
    expect(escapeCsvValue("Elektro Meier")).toBe("Elektro Meier");
    expect(escapeCsvValue(42)).toBe("42");
  });

  it("gibt für leere Werte einen leeren String", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
    expect(escapeCsvValue("")).toBe("");
  });

  it("umschliesst Werte mit Trennzeichen, Anführungszeichen oder Umbruch", () => {
    expect(escapeCsvValue("a;b")).toBe('"a;b"');
    expect(escapeCsvValue('sagt "hallo"')).toBe('"sagt ""hallo"""');
    expect(escapeCsvValue("Zeile1\nZeile2")).toBe('"Zeile1\nZeile2"');
  });

  /**
   * Firmennamen stammen aus einer externen Datenquelle. Ein führendes `=`
   * würde Excel dazu bringen, den Wert als Formel auszuwerten.
   */
  it("entschärft Formeln (CSV-Injection)", () => {
    expect(escapeCsvValue("=1+1")).toBe("'=1+1");
    expect(escapeCsvValue("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(escapeCsvValue("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(isDangerousCsvValue("-WEBSERVICE(\"x\")")).toBe(true);
    // Enthält zusätzlich Anführungszeichen, wird also noch maskiert: "'=…
    expect(escapeCsvValue('=HYPERLINK("http://boese.example")')).toBe(
      '"\'=HYPERLINK(""http://boese.example"")"',
    );
  });

  it("entschärft Formeln auch bei nötiger Maskierung", () => {
    expect(escapeCsvValue("=a;b")).toBe("\"'=a;b\"");
  });

  /**
   * Telefonnummern und negative Zahlen beginnen zwar mit + bzw. -, enthalten
   * aber keine Buchstaben und sind damit keine Formel.
   */
  it("lässt Telefonnummern und negative Zahlen unverändert", () => {
    expect(escapeCsvValue("+49 221 342109")).toBe("+49 221 342109");
    expect(escapeCsvValue("+49 (221) 34-21")).toBe("+49 (221) 34-21");
    expect(escapeCsvValue("-5")).toBe("-5");
    expect(escapeCsvValue("-12,5")).toBe("-12,5");
  });

  it("unterscheidet harmlose von gefährlichen Werten", () => {
    expect(isDangerousCsvValue("+49 221 342109")).toBe(false);
    expect(isDangerousCsvValue("-5")).toBe(false);
    expect(isDangerousCsvValue("Elektro Meier")).toBe(false);
    expect(isDangerousCsvValue("+SUM(A1)")).toBe(true);
    expect(isDangerousCsvValue("=1+1")).toBe(true);
    expect(isDangerousCsvValue("@cmd")).toBe(true);
    expect(isDangerousCsvValue("\tTab")).toBe(true);
  });
});

describe("buildCsv", () => {
  type Zeile = { firma: string; score: number | null };
  const spalten = [
    { header: "Firma", value: (row: Zeile) => row.firma },
    { header: "Potenzial", value: (row: Zeile) => csvNumber(row.score) },
  ];

  it("beginnt mit einem BOM, damit Excel Umlaute erkennt", () => {
    expect(buildCsv<Zeile>([], spalten).startsWith(UTF8_BOM)).toBe(true);
  });

  it("schreibt Kopfzeile und Datenzeilen mit Semikolon", () => {
    const csv = buildCsv<Zeile>(
      [
        { firma: "Müller GmbH", score: 83 },
        { firma: "Schmidt & Co", score: null },
      ],
      spalten,
    );
    const zeilen = csv.replace(UTF8_BOM, "").trimEnd().split("\r\n");
    expect(zeilen[0]).toBe("Firma;Potenzial");
    expect(zeilen[1]).toBe("Müller GmbH;83");
    expect(zeilen[2]).toBe("Schmidt & Co;");
  });

  it("nutzt CRLF als Zeilenende", () => {
    const csv = buildCsv<Zeile>([{ firma: "A", score: 1 }], spalten);
    expect(csv).toContain("\r\n");
  });

  it("erzeugt auch ohne Zeilen eine Kopfzeile", () => {
    const csv = buildCsv<Zeile>([], spalten).replace(UTF8_BOM, "").trimEnd();
    expect(csv).toBe("Firma;Potenzial");
  });
});

describe("Hilfsformate", () => {
  it("schreibt Zahlen mit deutschem Dezimalzeichen", () => {
    expect(csvNumber(83)).toBe("83");
    expect(csvNumber(8.5)).toBe("8,5");
    expect(csvNumber(null)).toBe("");
    expect(csvNumber(Number.NaN)).toBe("");
  });

  it("schreibt Datum und Uhrzeit deutsch", () => {
    expect(csvDate("2026-09-29T08:05:00.000Z")).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);
    expect(csvDate(null)).toBe("");
    expect(csvDate("kein datum")).toBe("");
  });

  it("schreibt Wahrheitswerte als ja/nein", () => {
    expect(csvBoolean(true)).toBe("ja");
    expect(csvBoolean(false)).toBe("nein");
    expect(csvBoolean(null)).toBe("");
  });

  it("baut Dateinamen mit Datum und ohne Sonderzeichen", () => {
    const name = csvFilename("kundenradar leads", new Date("2026-10-01T10:00:00Z"));
    expect(name).toBe("kundenradar-leads-2026-10-01.csv");
    expect(csvFilename("../../etc/passwd", new Date("2026-01-02T00:00:00Z"))).toBe(
      "etc-passwd-2026-01-02.csv",
    );
  });
});
