/**
 * CSV-Erzeugung für den Vertriebsalltag.
 *
 * Zielanwendung ist Excel im deutschsprachigen Raum. Deshalb:
 *   * Semikolon als Trennzeichen (Excel erwartet das bei deutschem Gebietsschema)
 *   * CRLF als Zeilenende
 *   * UTF-8 mit BOM, damit Umlaute korrekt ankommen
 *
 * Sicherheit: Felder, die mit `=`, `+`, `-` oder `@` beginnen, werden von
 * Tabellenkalkulationen als Formel ausgewertet. Da Firmennamen aus einer
 * externen Datenquelle stammen, werden solche Werte entschärft
 * (CSV-Injection).
 */

export const CSV_DELIMITER = ";";
const LINE_BREAK = "\r\n";
export const UTF8_BOM = "﻿";

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Werte, die zwar mit `+` oder `-` beginnen, aber ausschliesslich aus Ziffern
 * und Satzzeichen bestehen – also Telefonnummern und negative Zahlen.
 *
 * Gefährliche Nutzlasten (`=HYPERLINK(…)`, `+SUM(…)`, `@cmd`) enthalten immer
 * Buchstaben. Diese Werte dürfen deshalb unverändert bleiben, sonst stünde in
 * jeder Telefonspalte ein sichtbares Hochkomma.
 */
const HARMLESS_NUMERIC = /^[+-][\d\s/().,-]+$/;

export function isDangerousCsvValue(text: string): boolean {
  if (!FORMULA_START.test(text)) return false;
  return !HARMLESS_NUMERIC.test(text);
}

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);
  if (text.length === 0) return "";

  // Formel-Einleitung entschärfen, Inhalt aber lesbar lassen.
  if (isDangerousCsvValue(text)) text = `'${text}`;

  const needsQuotes =
    text.includes(CSV_DELIMITER) ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r");

  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => unknown;
};

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((column) => escapeCsvValue(column.header)).join(CSV_DELIMITER);
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvValue(column.value(row))).join(CSV_DELIMITER),
  );
  return UTF8_BOM + [head, ...body].join(LINE_BREAK) + LINE_BREAK;
}

/** Deutsches Zahlenformat, damit Excel die Werte als Zahl erkennt. */
export function csvNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return String(value).replace(".", ",");
}

export function csvDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function csvBoolean(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value ? "ja" : "nein";
}

/** Dateiname mit Datum, ohne Zeichen, die Betriebssysteme stören. */
export function csvFilename(prefix: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safePrefix || "export"}-${stamp}.csv`;
}
