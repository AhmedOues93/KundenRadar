import "server-only";

import type { AnalysisResult } from "@/lib/types";
import { BATCH_DEFAULTS } from "./batch-limits";
import { analyzeWebsite } from "./run";

export { BATCH_DEFAULTS };

/**
 * Kontrollierte Stapel-Analyse.
 *
 * Nutzt die bestehende Analyse aus Phase 1 unverändert – es gibt keine zweite
 * Analyse-Engine und damit auch keinen zweiten SSRF-Schutz, der abweichen
 * könnte.
 *
 * Eigenschaften:
 *   * geringe Parallelität (Vorgabe 2 gleichzeitige Analysen)
 *   * Mindestabstand zwischen Starts, um fremde Server nicht zu belasten
 *   * Zeitbudget für den gesamten Stapel
 *   * ein Fehler stoppt den Stapel nicht – er wird dem Element zugeordnet
 */

export type BatchItem = {
  /** Kennung des Leads, zu dem die Analyse gehört. */
  id: string;
  url: string;
};

export type BatchOutcome =
  | { id: string; url: string; ok: true; result: AnalysisResult }
  | { id: string; url: string; ok: false; error: string; skipped?: boolean };

export type BatchOptions = {
  concurrency?: number;
  minDelayMs?: number;
  totalBudgetMs?: number;
  /** Austauschbar für Tests; Vorgabe ist die Phase-1-Analyse. */
  analyze?: (url: string) => Promise<AnalysisResult>;
  /** Austauschbar für Tests, damit nicht echt gewartet werden muss. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Wird nach jedem abgeschlossenen Element aufgerufen. */
  onSettled?: (outcome: BatchOutcome) => void | Promise<void>;
};

export type BatchSummary = {
  outcomes: BatchOutcome[];
  succeeded: number;
  failed: number;
  skipped: number;
  /** True, wenn das Zeitbudget erschöpft war und Elemente übrig blieben. */
  budgetExhausted: boolean;
};

/**
 * Arbeitet die Elemente mit begrenzter Parallelität ab. Die Reihenfolge der
 * Ergebnisse entspricht der Reihenfolge der Eingabe.
 */
export async function runAnalysisBatch(
  items: BatchItem[],
  options: BatchOptions = {},
): Promise<BatchSummary> {
  const concurrency = Math.max(1, options.concurrency ?? BATCH_DEFAULTS.concurrency);
  const minDelayMs = Math.max(0, options.minDelayMs ?? BATCH_DEFAULTS.minDelayMs);
  const totalBudgetMs = options.totalBudgetMs ?? BATCH_DEFAULTS.totalBudgetMs;
  const analyze = options.analyze ?? analyzeWebsite;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const onSettled = options.onSettled;

  const outcomes = new Array<BatchOutcome>(items.length);
  const startedAt = now();
  let budgetExhausted = false;
  let cursor = 0;
  // Negative Unendlichkeit, damit der erste Start nicht auf den
  // Mindestabstand warten muss.
  let lastStartedAt = Number.NEGATIVE_INFINITY;

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;

      const item = items[index] as BatchItem;

      // Zeitbudget erschöpft: verbleibende Elemente werden als übersprungen
      // markiert, statt den Aufruf hängen zu lassen.
      if (now() - startedAt >= totalBudgetMs) {
        budgetExhausted = true;
        const outcome: BatchOutcome = {
          id: item.id,
          url: item.url,
          ok: false,
          error: "Das Zeitbudget des Stapels war erschöpft. Bitte erneut starten.",
          skipped: true,
        };
        outcomes[index] = outcome;
        await onSettled?.(outcome);
        continue;
      }

      // Mindestabstand zwischen Starts einhalten (Rate Limit).
      if (minDelayMs > 0) {
        const wait = lastStartedAt + minDelayMs - now();
        if (wait > 0) await sleep(wait);
        lastStartedAt = now();
      }

      let outcome: BatchOutcome;
      try {
        const result = await analyze(item.url);
        outcome = { id: item.id, url: item.url, ok: true, result };
      } catch (error) {
        // Eine unerwartete Ausnahme darf den Stapel nicht abbrechen.
        outcome = {
          id: item.id,
          url: item.url,
          ok: false,
          error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Analyse.",
        };
      }

      outcomes[index] = outcome;

      try {
        await onSettled?.(outcome);
      } catch (error) {
        // Auch ein Fehler beim Speichern darf den Stapel nicht stoppen.
        console.error("Ergebnis konnte nicht verarbeitet werden:", error);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () => worker()),
  );

  const settled = outcomes.filter(Boolean) as BatchOutcome[];

  return {
    outcomes: settled,
    succeeded: settled.filter((outcome) => outcome.ok).length,
    failed: settled.filter((outcome) => !outcome.ok && !outcome.skipped).length,
    skipped: settled.filter((outcome) => !outcome.ok && outcome.skipped).length,
    budgetExhausted,
  };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
