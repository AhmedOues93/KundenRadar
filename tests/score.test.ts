import { describe, expect, it } from "vitest";
import { SCORE_WEIGHTS, evaluate } from "@/lib/analysis/score";
import { scoreBand } from "@/lib/constants";
import type { AnalysisMetrics } from "@/lib/types";

/** Eine technisch einwandfreie Seite als Ausgangspunkt. */
function goodMetrics(overrides: Partial<AnalysisMetrics> = {}): AnalysisMetrics {
  return {
    httpStatus: 200,
    https: true,
    redirectCount: 0,
    redirectChain: ["https://example.com/"],
    responseTimeMs: 300,
    pageTitle: "Musterfirma – Sanitär und Heizung in Köln",
    metaDescription:
      "Ihr Fachbetrieb für Sanitär und Heizung im Raum Köln. Wir beraten Sie persönlich und zuverlässig.",
    h1: "Ihr Fachbetrieb",
    h1Count: 1,
    hasViewport: true,
    canonical: "https://example.com/",
    langAttribute: "de",
    generator: null,
    cmsHints: [],
    robotsTxt: true,
    sitemapXml: true,
    openGraph: { title: "Musterfirma", description: "Beschreibung", image: null },
    structuredData: true,
    internalLinks: 12,
    externalLinks: 3,
    checkedLinks: 8,
    brokenLinks: [],
    imageCount: 10,
    imagesWithoutAlt: 0,
    largeImages: [],
    htmlBytes: 48_000,
    ...overrides,
  };
}

describe("evaluate – gute Seite", () => {
  const { score, findings } = evaluate(goodMetrics(), { found: false, agencyName: null, evidence: null, sourceUrl: null, location: null });

  it("vergibt keine Punkte", () => {
    expect(score).toBe(0);
  });

  it("weist die geprüften Punkte trotzdem als OK aus", () => {
    expect(findings.some((f) => f.id === "seo.title.ok")).toBe(true);
    expect(findings.some((f) => f.id === "mobile.viewport.ok")).toBe(true);
    expect(findings.every((f) => f.points === 0)).toBe(true);
  });

  it("ist reproduzierbar – derselbe Input ergibt denselben Score", () => {
    const again = evaluate(goodMetrics(), null);
    expect(again.score).toBe(score);
  });
});

describe("evaluate – einzelne Regeln", () => {
  it("bestraft fehlenden Titel", () => {
    const { score, findings } = evaluate(goodMetrics({ pageTitle: null }), null);
    expect(score).toBe(SCORE_WEIGHTS.titleMissing);
    const finding = findings.find((f) => f.id === "seo.title.missing");
    expect(finding?.severity).toBe("PROBLEM");
    expect(finding?.group).toBe("SEO");
    expect(finding?.meaning).toBeTruthy();
    expect(finding?.salesRelevance).toBeTruthy();
  });

  it("bestraft fehlendes HTTPS", () => {
    expect(evaluate(goodMetrics({ https: false }), null).score).toBe(SCORE_WEIGHTS.noHttps);
  });

  it("bestraft fehlenden Viewport", () => {
    expect(evaluate(goodMetrics({ hasViewport: false }), null).score).toBe(
      SCORE_WEIGHTS.viewportMissing,
    );
  });

  it("bestraft fehlende H1", () => {
    expect(evaluate(goodMetrics({ h1Count: 0, h1: null }), null).score).toBe(
      SCORE_WEIGHTS.h1Missing,
    );
  });

  it("bestraft fehlende Sitemap", () => {
    expect(evaluate(goodMetrics({ sitemapXml: false }), null).score).toBe(
      SCORE_WEIGHTS.sitemapMissing,
    );
  });

  it("bestraft fehlende Sprachangabe", () => {
    expect(evaluate(goodMetrics({ langAttribute: null }), null).score).toBe(
      SCORE_WEIGHTS.langMissing,
    );
  });

  it("skaliert Bilder ohne Alt-Text nach Anteil", () => {
    const halb = evaluate(goodMetrics({ imageCount: 10, imagesWithoutAlt: 5 }), null);
    const alle = evaluate(goodMetrics({ imageCount: 10, imagesWithoutAlt: 10 }), null);
    expect(halb.score).toBeLessThan(alle.score);
    expect(alle.score).toBe(SCORE_WEIGHTS.missingAltMax);
  });

  it("begrenzt Punkte für kaputte Links", () => {
    const broken = Array.from({ length: 8 }, (_, index) => ({
      url: `https://example.com/${index}`,
      status: 404,
    }));
    expect(evaluate(goodMetrics({ brokenLinks: broken }), null).score).toBe(
      SCORE_WEIGHTS.brokenLinkMax,
    );
  });

  it("staffelt die Antwortzeit", () => {
    expect(evaluate(goodMetrics({ responseTimeMs: 1_500 }), null).score).toBe(
      SCORE_WEIGHTS.moderateResponse,
    );
    expect(evaluate(goodMetrics({ responseTimeMs: 4_000 }), null).score).toBe(
      SCORE_WEIGHTS.slowResponse,
    );
  });

  it("bewertet Agenturhinweise mit null Punkten", () => {
    const withHint = evaluate(goodMetrics(), {
      found: true,
      agencyName: "Agentur Beispiel",
      evidence: "Website by Agentur Beispiel",
      sourceUrl: "https://example.com/",
      location: "footer",
    });
    expect(withHint.score).toBe(0);
    const finding = withHint.findings.find((f) => f.id === "agency.hint.found");
    expect(finding?.points).toBe(0);
    expect(finding?.title).toContain("Agenturhinweis gefunden");
  });
});

describe("evaluate – schlechte Seite", () => {
  const bad = goodMetrics({
    httpStatus: 503,
    https: false,
    responseTimeMs: 6_000,
    pageTitle: null,
    metaDescription: null,
    h1: null,
    h1Count: 0,
    hasViewport: false,
    canonical: null,
    langAttribute: null,
    robotsTxt: false,
    sitemapXml: false,
    openGraph: { title: null, description: null, image: null },
    structuredData: false,
    imageCount: 6,
    imagesWithoutAlt: 6,
    brokenLinks: [
      { url: "https://example.com/a", status: 404 },
      { url: "https://example.com/b", status: 500 },
      { url: "https://example.com/c", status: null },
    ],
    largeImages: [
      { url: "https://example.com/a.jpg", bytes: 900_000 },
      { url: "https://example.com/b.jpg", bytes: 1_200_000 },
    ],
    htmlBytes: 2_000,
  });

  const { score, findings } = evaluate(bad, null);

  it("erreicht die Obergrenze von 100", () => {
    expect(score).toBe(100);
  });

  it("bleibt im höchsten Band", () => {
    expect(scoreBand(score)?.label).toBe("Hohes Analysepotenzial");
  });

  it("liefert Findings in allen Gruppen", () => {
    const groups = new Set(findings.map((f) => f.group));
    for (const group of ["TECHNIK", "SEO", "MOBILE", "ACCESSIBILITY", "CONTENT", "AGENCY"]) {
      expect(groups.has(group as never), group).toBe(true);
    }
  });

  it("gibt jedem Finding eine stabile Kennung", () => {
    const ids = findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("scoreBand", () => {
  it("ordnet Werte den dokumentierten Bändern zu", () => {
    expect(scoreBand(0)?.label).toBe("Geringes technisches Potenzial");
    expect(scoreBand(29)?.label).toBe("Geringes technisches Potenzial");
    expect(scoreBand(30)?.label).toBe("Prüfen");
    expect(scoreBand(59)?.label).toBe("Prüfen");
    expect(scoreBand(60)?.label).toBe("Interessant");
    expect(scoreBand(79)?.label).toBe("Interessant");
    expect(scoreBand(80)?.label).toBe("Hohes Analysepotenzial");
    expect(scoreBand(100)?.label).toBe("Hohes Analysepotenzial");
    expect(scoreBand(null)).toBeNull();
  });
});
