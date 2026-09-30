import { describe, expect, it } from "vitest";
import { runAnalysisBatch, type BatchItem } from "@/lib/analysis/batch";
import { BATCH_DEFAULTS } from "@/lib/analysis/batch-limits";
import type { AnalysisResult } from "@/lib/types";

function items(count: number): BatchItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `lead-${index + 1}`,
    url: `https://firma-${index + 1}.de`,
  }));
}

function success(url: string, score = 42): AnalysisResult {
  return {
    requestedUrl: url,
    finalUrl: url,
    domain: new URL(url).hostname,
    status: "SUCCESS",
    errorMessage: null,
    score,
    findings: [],
    metrics: null,
    agencyHint: null,
  };
}

/** Kein echtes Warten in Tests. */
const noSleep = async () => {};

describe("runAnalysisBatch – Grundverhalten", () => {
  it("analysiert alle Elemente und behält die Reihenfolge", async () => {
    const summary = await runAnalysisBatch(items(5), {
      analyze: async (url) => success(url),
      sleep: noSleep,
    });

    expect(summary.succeeded).toBe(5);
    expect(summary.failed).toBe(0);
    expect(summary.outcomes.map((outcome) => outcome.id)).toEqual([
      "lead-1",
      "lead-2",
      "lead-3",
      "lead-4",
      "lead-5",
    ]);
  });

  it("verarbeitet eine leere Liste", async () => {
    const summary = await runAnalysisBatch([], { analyze: async (url) => success(url) });
    expect(summary.outcomes).toEqual([]);
    expect(summary.succeeded).toBe(0);
  });

  it("ruft onSettled für jedes Element auf", async () => {
    const seen: string[] = [];
    await runAnalysisBatch(items(4), {
      analyze: async (url) => success(url),
      sleep: noSleep,
      onSettled: (outcome) => {
        seen.push(outcome.id);
      },
    });
    expect(seen).toHaveLength(4);
    expect(new Set(seen).size).toBe(4);
  });

  it("gibt das Analyseergebnis an onSettled weiter", async () => {
    const scores: (number | null)[] = [];
    await runAnalysisBatch(items(2), {
      analyze: async (url) => success(url, 77),
      sleep: noSleep,
      onSettled: (outcome) => {
        if (outcome.ok) scores.push(outcome.result.score);
      },
    });
    expect(scores).toEqual([77, 77]);
  });
});

describe("runAnalysisBatch – Parallelität", () => {
  it("überschreitet die vorgegebene Parallelität nicht", async () => {
    let active = 0;
    let peak = 0;

    await runAnalysisBatch(items(10), {
      concurrency: 2,
      sleep: noSleep,
      analyze: async (url) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return success(url);
      },
    });

    expect(peak).toBeLessThanOrEqual(2);
  });

  it("nutzt standardmäßig eine geringe Parallelität", () => {
    expect(BATCH_DEFAULTS.concurrency).toBeLessThanOrEqual(3);
    expect(BATCH_DEFAULTS.minDelayMs).toBeGreaterThan(0);
  });

  it("hält den Mindestabstand zwischen Starts ein", async () => {
    const waited: number[] = [];
    let clock = 0;

    await runAnalysisBatch(items(3), {
      concurrency: 1,
      minDelayMs: 300,
      now: () => clock,
      sleep: async (ms) => {
        waited.push(ms);
        clock += ms;
      },
      analyze: async (url) => {
        clock += 10;
        return success(url);
      },
    });

    // Der erste Start braucht keine Wartezeit, die folgenden je ~290 ms.
    expect(waited.filter((ms) => ms > 0).length).toBe(2);
    for (const ms of waited.filter((value) => value > 0)) {
      expect(ms).toBeLessThanOrEqual(300);
    }
  });
});

describe("runAnalysisBatch – Fehlerbehandlung", () => {
  it("stoppt nicht, wenn ein Element wirft", async () => {
    const summary = await runAnalysisBatch(items(5), {
      sleep: noSleep,
      analyze: async (url) => {
        if (url.includes("firma-3")) throw new Error("Zeitüberschreitung");
        return success(url);
      },
    });

    expect(summary.succeeded).toBe(4);
    expect(summary.failed).toBe(1);
    expect(summary.outcomes).toHaveLength(5);

    const failure = summary.outcomes.find((outcome) => !outcome.ok);
    expect(failure).toBeDefined();
    expect(failure!.ok).toBe(false);
    if (!failure!.ok) expect(failure!.error).toBe("Zeitüberschreitung");
  });

  it("überlebt mehrere Fehler in Folge", async () => {
    const summary = await runAnalysisBatch(items(4), {
      sleep: noSleep,
      analyze: async () => {
        throw new Error("Quelle nicht erreichbar");
      },
    });

    expect(summary.failed).toBe(4);
    expect(summary.succeeded).toBe(0);
    expect(summary.outcomes).toHaveLength(4);
  });

  it("behandelt einen geworfenen Nicht-Fehler", async () => {
    const summary = await runAnalysisBatch(items(1), {
      sleep: noSleep,
      analyze: async () => {
        throw "kaputt";
      },
    });

    const outcome = summary.outcomes[0]!;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("Unbekannter Fehler");
  });

  it("stoppt nicht, wenn onSettled wirft", async () => {
    const summary = await runAnalysisBatch(items(3), {
      sleep: noSleep,
      analyze: async (url) => success(url),
      onSettled: () => {
        throw new Error("Speichern fehlgeschlagen");
      },
    });

    expect(summary.outcomes).toHaveLength(3);
    expect(summary.succeeded).toBe(3);
  });

  it("gibt eine fehlgeschlagene Analyse als Ergebnis weiter, nicht als Ausnahme", async () => {
    const summary = await runAnalysisBatch(items(1), {
      sleep: noSleep,
      analyze: async (url) => ({
        requestedUrl: url,
        finalUrl: null,
        domain: null,
        status: "BLOCKED",
        errorMessage: "Interne Adresse",
        score: null,
        findings: [],
        metrics: null,
        agencyHint: null,
      }),
    });

    const outcome = summary.outcomes[0]!;
    // Der Stapel wertet das als erfolgreich verarbeitet; der Status steckt im
    // Ergebnis und wird beim Speichern ausgewertet.
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.result.status).toBe("BLOCKED");
  });
});

describe("runAnalysisBatch – Zeitbudget", () => {
  it("überspringt verbleibende Elemente, wenn das Budget erschöpft ist", async () => {
    let clock = 0;

    const summary = await runAnalysisBatch(items(6), {
      concurrency: 1,
      minDelayMs: 0,
      totalBudgetMs: 100,
      now: () => clock,
      sleep: noSleep,
      analyze: async (url) => {
        clock += 40;
        return success(url);
      },
    });

    expect(summary.budgetExhausted).toBe(true);
    expect(summary.skipped).toBeGreaterThan(0);
    expect(summary.succeeded + summary.skipped + summary.failed).toBe(6);
  });

  it("markiert übersprungene Elemente erkennbar", async () => {
    let clock = 0;
    const summary = await runAnalysisBatch(items(3), {
      concurrency: 1,
      minDelayMs: 0,
      totalBudgetMs: 0,
      now: () => clock++,
      sleep: noSleep,
      analyze: async (url) => success(url),
    });

    expect(summary.skipped).toBe(3);
    for (const outcome of summary.outcomes) {
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.skipped).toBe(true);
        expect(outcome.error).toContain("Zeitbudget");
      }
    }
  });

  it("begrenzt die Stapelgrösse in der Vorgabe", () => {
    expect(BATCH_DEFAULTS.maxItems).toBeLessThanOrEqual(50);
    expect(BATCH_DEFAULTS.totalBudgetMs).toBeGreaterThan(0);
  });
});
