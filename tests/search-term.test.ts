import { describe, expect, it } from "vitest";
import { hasSearchContent, likePattern, sanitizeSearchTerm } from "@/lib/search-term";

describe("sanitizeSearchTerm", () => {
  it("lässt normale Suchbegriffe unverändert", () => {
    expect(sanitizeSearchTerm("Elektro Meier")).toBe("Elektro Meier");
    expect(sanitizeSearchTerm("Müller & Söhne")).toBe("Müller & Söhne");
    expect(sanitizeSearchTerm("elektro-meier.de")).toBe("elektro-meier.de");
  });

  /**
   * Der eigentliche Grund für diese Funktion: PostgREST trennt den
   * `or=(…)`-Ausdruck an Kommas und Klammern.
   */
  it("entfernt Zeichen, die den Filterausdruck zerlegen könnten", () => {
    expect(sanitizeSearchTerm("a,b")).toBe("a b");
    expect(sanitizeSearchTerm("x,potential_score.gte.0")).toBe("x potential_score.gte.0");
    expect(sanitizeSearchTerm("a)or(b")).toBe("a or b");
    expect(sanitizeSearchTerm('a"b')).toBe("a b");
    expect(sanitizeSearchTerm("a\\b")).toBe("a b");
    expect(sanitizeSearchTerm("a*b")).toBe("a b");
  });

  it("normalisiert Leerraum und schneidet überlange Eingaben ab", () => {
    expect(sanitizeSearchTerm("  viel    Luft  ")).toBe("viel Luft");
    expect(sanitizeSearchTerm("a".repeat(200)).length).toBe(80);
  });

  it("ergibt für reine Sonderzeichen einen leeren Begriff", () => {
    expect(sanitizeSearchTerm(",,,")).toBe("");
    expect(sanitizeSearchTerm("   ")).toBe("");
  });
});

describe("likePattern", () => {
  it("umschliesst den Begriff mit Platzhaltern", () => {
    expect(likePattern("Meier")).toBe("%Meier%");
  });

  it("maskiert Platzhalter im Begriff, damit sie wörtlich gesucht werden", () => {
    expect(likePattern("50%")).toBe("%50\\%%");
    expect(likePattern("a_b")).toBe("%a\\_b%");
  });

  it("entfernt strukturelle Zeichen auch im Muster", () => {
    expect(likePattern("a,b")).toBe("%a b%");
    expect(likePattern("*")).toBe("%%");
  });
});

describe("hasSearchContent", () => {
  it("erkennt leere und wirkungslose Eingaben", () => {
    expect(hasSearchContent("Meier")).toBe(true);
    expect(hasSearchContent("")).toBe(false);
    expect(hasSearchContent("   ")).toBe(false);
    expect(hasSearchContent(",,")).toBe(false);
    expect(hasSearchContent(null)).toBe(false);
    expect(hasSearchContent(undefined)).toBe(false);
  });
});
