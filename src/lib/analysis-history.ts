import type { Finding, WebsiteAnalysis } from "@/lib/types";

/**
 * Auswertung des Analyse-Verlaufs eines Leads.
 *
 * Rein und ohne Datenbankzugriff: die Seite lädt die Analysen, diese Funktionen
 * leiten daraus Verlauf und Veränderung ab.
 */

export type HistoryPoint = {
  analysisId: string;
  at: string;
  score: number;
  /** Veränderung gegenüber der vorherigen erfolgreichen Analyse. */
  delta: number | null;
};

export type FindingChange = {
  id: string;
  title: string;
  points: number;
  kind: "BEHOBEN" | "NEU";
};

export type AnalysisHistory = {
  points: HistoryPoint[];
  latest: WebsiteAnalysis | null;
  previous: WebsiteAnalysis | null;
  /** Unterschied der punktebringenden Findings zwischen den letzten beiden Läufen. */
  changes: FindingChange[];
  failedCount: number;
};

/** Analysen kommen absteigend sortiert; der Verlauf läuft aufsteigend. */
export function buildHistory(analyses: WebsiteAnalysis[]): AnalysisHistory {
  const successful = analyses
    .filter((analysis) => analysis.status === "SUCCESS" && analysis.score !== null)
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const points: HistoryPoint[] = successful.map((analysis, index) => {
    const previousScore = index > 0 ? (successful[index - 1]?.score ?? null) : null;
    const score = analysis.score as number;
    return {
      analysisId: analysis.id,
      at: analysis.created_at,
      score,
      delta: previousScore === null ? null : score - previousScore,
    };
  });

  const latest = successful[successful.length - 1] ?? null;
  const previous = successful.length > 1 ? (successful[successful.length - 2] ?? null) : null;

  return {
    points,
    latest,
    previous,
    changes: latest && previous ? diffFindings(previous.findings, latest.findings) : [],
    failedCount: analyses.filter((analysis) => analysis.status !== "SUCCESS").length,
  };
}

/** Welche punktebringenden Findings sind weggefallen, welche neu hinzugekommen? */
export function diffFindings(before: Finding[], after: Finding[]): FindingChange[] {
  const scoring = (findings: Finding[]) =>
    new Map(findings.filter((finding) => finding.points > 0).map((finding) => [finding.id, finding]));

  const vorher = scoring(before ?? []);
  const nachher = scoring(after ?? []);
  const changes: FindingChange[] = [];

  for (const [id, finding] of vorher) {
    if (!nachher.has(id)) {
      changes.push({ id, title: finding.title, points: finding.points, kind: "BEHOBEN" });
    }
  }
  for (const [id, finding] of nachher) {
    if (!vorher.has(id)) {
      changes.push({ id, title: finding.title, points: finding.points, kind: "NEU" });
    }
  }

  // Grösste Punktwirkung zuerst, behobene vor neuen.
  return changes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "BEHOBEN" ? -1 : 1;
    return b.points - a.points;
  });
}

/**
 * Massstab der Sparkline.
 *
 * Nicht fix 0..100: bei Werten zwischen 83 und 95 wäre die Linie sonst
 * schnurgerade. Stattdessen die tatsächliche Spannweite, aber mindestens
 * `MIN_SPAN` Punkte, damit minimale Schwankungen nicht dramatisch wirken.
 * `PADDING` hält die Punkte innerhalb der Zeichenfläche, sonst wird der
 * letzte Kreis am Rand abgeschnitten.
 */
const MIN_SPAN = 20;
const PADDING = 4;

export function sparklineScale(
  points: HistoryPoint[],
  width: number,
  height: number,
): { x: (index: number) => number; y: (score: number) => number } {
  const scores = points.map((point) => point.score);
  const roh = Math.max(...scores) - Math.min(...scores);
  const spanne = Math.max(roh, MIN_SPAN);
  const mitte = (Math.max(...scores) + Math.min(...scores)) / 2;
  const min = mitte - spanne / 2;

  const nutzbareBreite = Math.max(width - 2 * PADDING, 1);
  const nutzbareHoehe = Math.max(height - 2 * PADDING, 1);
  const teiler = Math.max(points.length - 1, 1);

  return {
    x: (index) => PADDING + (index / teiler) * nutzbareBreite,
    y: (score) => PADDING + nutzbareHoehe - ((score - min) / spanne) * nutzbareHoehe,
  };
}

/** Pfad der Sparkline; `null`, solange weniger als zwei Läufe vorliegen. */
export function sparklinePath(
  points: HistoryPoint[],
  width: number,
  height: number,
): string | null {
  if (points.length < 2) return null;
  const scale = sparklineScale(points, width, height);

  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${scale.x(index).toFixed(1)},${scale.y(point.score).toFixed(1)}`,
    )
    .join(" ");
}
