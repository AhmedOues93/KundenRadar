import { describe, expect, it } from "vitest";
import { buildHistory, diffFindings, sparklinePath, sparklineScale } from "@/lib/analysis-history";
import type { Finding, WebsiteAnalysis } from "@/lib/types";

function finding(id: string, points: number, title = id): Finding {
  return {
    id,
    group: "SEO",
    severity: points > 0 ? "PROBLEM" : "OK",
    title,
    meaning: "",
    salesRelevance: "",
    points,
  };
}

function analysis(o: Partial<WebsiteAnalysis> & { id: string; created_at: string }): WebsiteAnalysis {
  return {
    organization_id: "org",
    lead_id: "lead",
    requested_url: "https://x.de",
    final_url: "https://x.de",
    domain: "x.de",
    status: "SUCCESS",
    error_message: null,
    http_status: 200,
    response_time_ms: 300,
    score: 50,
    findings: [],
    metrics: null,
    agency_hint: null,
    created_by: null,
    ...o,
  } as WebsiteAnalysis;
}

describe("buildHistory", () => {
  it("sortiert aufsteigend und berechnet die Veränderung", () => {
    const history = buildHistory([
      analysis({ id: "c", created_at: "2026-03-01T10:00:00Z", score: 40 }),
      analysis({ id: "a", created_at: "2026-01-01T10:00:00Z", score: 80 }),
      analysis({ id: "b", created_at: "2026-02-01T10:00:00Z", score: 60 }),
    ]);

    expect(history.points.map((point) => point.analysisId)).toEqual(["a", "b", "c"]);
    expect(history.points.map((point) => point.delta)).toEqual([null, -20, -20]);
    expect(history.latest?.id).toBe("c");
    expect(history.previous?.id).toBe("b");
  });

  it("ignoriert fehlgeschlagene Läufe, zählt sie aber", () => {
    const history = buildHistory([
      analysis({ id: "ok", created_at: "2026-01-01T10:00:00Z", score: 50 }),
      analysis({ id: "fail", created_at: "2026-02-01T10:00:00Z", status: "FAILED", score: null }),
      analysis({ id: "blocked", created_at: "2026-03-01T10:00:00Z", status: "BLOCKED", score: null }),
    ]);

    expect(history.points).toHaveLength(1);
    expect(history.failedCount).toBe(2);
  });

  it("kommt mit einem einzelnen Lauf zurecht", () => {
    const history = buildHistory([analysis({ id: "a", created_at: "2026-01-01T10:00:00Z", score: 70 })]);
    expect(history.points).toHaveLength(1);
    expect(history.points[0]!.delta).toBeNull();
    expect(history.previous).toBeNull();
    expect(history.changes).toEqual([]);
  });

  it("kommt ohne Analysen zurecht", () => {
    const history = buildHistory([]);
    expect(history.points).toEqual([]);
    expect(history.latest).toBeNull();
    expect(history.failedCount).toBe(0);
  });

  it("vergleicht die Findings der letzten beiden Läufe", () => {
    const history = buildHistory([
      analysis({
        id: "alt",
        created_at: "2026-01-01T10:00:00Z",
        score: 30,
        findings: [finding("seo.title.missing", 10), finding("mobile.viewport.missing", 12)],
      }),
      analysis({
        id: "neu",
        created_at: "2026-02-01T10:00:00Z",
        score: 18,
        findings: [finding("mobile.viewport.missing", 12), finding("seo.sitemap.missing", 6)],
      }),
    ]);

    expect(history.changes).toEqual([
      { id: "seo.title.missing", title: "seo.title.missing", points: 10, kind: "BEHOBEN" },
      { id: "seo.sitemap.missing", title: "seo.sitemap.missing", points: 6, kind: "NEU" },
    ]);
  });
});

describe("diffFindings", () => {
  it("meldet behobene und neue Findings", () => {
    const changes = diffFindings(
      [finding("a", 5), finding("b", 3)],
      [finding("b", 3), finding("c", 8)],
    );
    expect(changes.map((change) => `${change.kind}:${change.id}`)).toEqual(["BEHOBEN:a", "NEU:c"]);
  });

  it("ignoriert Findings ohne Punkte", () => {
    expect(diffFindings([finding("ok", 0)], [finding("auch-ok", 0)])).toEqual([]);
  });

  it("meldet nichts bei unveränderten Findings", () => {
    expect(diffFindings([finding("a", 5)], [finding("a", 5)])).toEqual([]);
  });

  it("sortiert behobene vor neue, je nach Punkten absteigend", () => {
    const changes = diffFindings(
      [finding("klein", 2), finding("gross", 12)],
      [finding("neu-klein", 3), finding("neu-gross", 9)],
    );
    expect(changes.map((change) => change.id)).toEqual(["gross", "klein", "neu-gross", "neu-klein"]);
  });

  it("verträgt leere Eingaben", () => {
    expect(diffFindings([], [])).toEqual([]);
  });
});

describe("sparklinePath", () => {
  it("liefert erst ab zwei Punkten einen Pfad", () => {
    const einer = buildHistory([analysis({ id: "a", created_at: "2026-01-01T10:00:00Z", score: 10 })]);
    expect(sparklinePath(einer.points, 100, 20)).toBeNull();
  });

  it("hält alle Punkte innerhalb der Zeichenfläche", () => {
    const history = buildHistory([
      analysis({ id: "a", created_at: "2026-01-01T10:00:00Z", score: 10 }),
      analysis({ id: "b", created_at: "2026-02-01T10:00:00Z", score: 90 }),
      analysis({ id: "c", created_at: "2026-03-01T10:00:00Z", score: 50 }),
    ]);
    const breite = 100;
    const hoehe = 20;
    const scale = sparklineScale(history.points, breite, hoehe);

    history.points.forEach((point, index) => {
      const x = scale.x(index);
      const y = scale.y(point.score);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(breite);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(hoehe);
    });

    // Erster Punkt links, letzter rechts.
    expect(scale.x(0)).toBeLessThan(scale.x(history.points.length - 1));
  });

  /**
   * Bei eng beieinanderliegenden Werten darf die Linie nicht schnurgerade
   * sein – sonst ist der Verlauf nicht ablesbar.
   */
  it("spreizt kleine Unterschiede sichtbar", () => {
    const history = buildHistory([
      analysis({ id: "a", created_at: "2026-01-01T10:00:00Z", score: 95 }),
      analysis({ id: "b", created_at: "2026-02-01T10:00:00Z", score: 89 }),
      analysis({ id: "c", created_at: "2026-03-01T10:00:00Z", score: 83 }),
    ]);
    const scale = sparklineScale(history.points, 240, 44);
    const abstand = Math.abs(scale.y(95) - scale.y(83));
    expect(abstand).toBeGreaterThan(8);
  });

  it("gibt einen Pfad mit einem Punkt je Lauf zurück", () => {
    const history = buildHistory([
      analysis({ id: "a", created_at: "2026-01-01T10:00:00Z", score: 10 }),
      analysis({ id: "b", created_at: "2026-02-01T10:00:00Z", score: 90 }),
    ]);
    const path = sparklinePath(history.points, 100, 20)!;
    expect(path.startsWith("M")).toBe(true);
    expect(path.split("L")).toHaveLength(2);
  });
});
