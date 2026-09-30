/**
 * Grenzen der Stapel-Analyse.
 *
 * Bewusst in einem eigenen Modul ohne Server-Importe: die Oberfläche zeigt
 * diese Werte an, darf dabei aber nicht die Analyse-Engine (und mit ihr
 * `node:dns`/`node:net` aus dem SSRF-Schutz) in das Browser-Bundle ziehen.
 */
export const BATCH_DEFAULTS = {
  concurrency: 2,
  /** Mindestabstand zwischen zwei gestarteten Analysen. */
  minDelayMs: 350,
  /** Höchstzahl an Elementen pro Aufruf. */
  maxItems: 25,
  /** Zeitbudget für den gesamten Stapel. */
  totalBudgetMs: 240_000,
} as const;
