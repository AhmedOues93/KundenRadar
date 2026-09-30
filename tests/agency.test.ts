import { describe, expect, it } from "vitest";
import { detectAgencyHint, extractFooterLikeRegions } from "@/lib/analysis/agency";

function detect(html: string) {
  return detectAgencyHint({
    html,
    pageUrl: "https://kunde.de/",
    ownHost: "kunde.de",
  });
}

describe("detectAgencyHint – Credit-Formulierungen", () => {
  it("erkennt „Website by“", () => {
    const hint = detect('<footer><p>Website by Studio Nordlicht</p></footer>');
    expect(hint.found).toBe(true);
    expect(hint.agencyName).toBe("Studio Nordlicht");
    expect(hint.location).toBe("footer");
    expect(hint.sourceUrl).toBe("https://kunde.de/");
    expect(hint.evidence).toContain("Studio Nordlicht");
  });

  it("erkennt „Realisiert durch“", () => {
    const hint = detect("<footer>Realisiert durch Medienwerk Bremen GmbH.</footer>");
    expect(hint.found).toBe(true);
    expect(hint.agencyName).toBe("Medienwerk Bremen GmbH");
  });

  it("erkennt „Umsetzung:“", () => {
    const hint = detect("<footer><span>Umsetzung: Pixelhaus Leipzig</span></footer>");
    expect(hint.found).toBe(true);
    expect(hint.agencyName).toBe("Pixelhaus Leipzig");
  });

  it("erkennt „Designed by“", () => {
    const hint = detect("<footer>Designed by Kreativbüro Adler</footer>");
    expect(hint.found).toBe(true);
    expect(hint.agencyName).toBe("Kreativbüro Adler");
  });

  it("ignoriert Plattform-Credits", () => {
    for (const html of [
      "<footer>Powered by WordPress</footer>",
      "<footer>Created by Wix</footer>",
      "<footer>Website by Squarespace</footer>",
    ]) {
      const name = detect(html).agencyName ?? "";
      expect(name, html).not.toMatch(/wordpress|wix|squarespace/i);
    }
  });
});

describe("detectAgencyHint – Links", () => {
  it("erkennt einen externen Webdesign-Link im Footer", () => {
    const hint = detect(
      '<footer><a href="https://agentur-beispiel.de">Webdesign: Agentur Beispiel</a></footer>',
    );
    expect(hint.found).toBe(true);
    expect(hint.location).toBe("link");
    expect(hint.evidence).toContain("agentur-beispiel.de");
  });

  it("ignoriert interne Links auf eigene Unterseiten", () => {
    const hint = detect('<footer><a href="/webdesign-leistungen">Webdesign</a></footer>');
    expect(hint.location).not.toBe("link");
  });

  it("ignoriert Links auf www der eigenen Domain", () => {
    const hint = detect('<footer><a href="https://www.kunde.de/webdesign">Webdesign</a></footer>');
    expect(hint.location).not.toBe("link");
  });

  it("ignoriert Plattform-Domains", () => {
    const hint = detect(
      '<footer><a href="https://de.wordpress.org/">Webdesign mit WordPress</a></footer>',
    );
    expect(hint.location).not.toBe("link");
  });
});

describe("detectAgencyHint – Falschtreffer", () => {
  it("meldet nichts auf einer Seite ohne Hinweise", () => {
    const hint = detect(
      "<footer><p>Musterfirma GmbH · Hauptstrasse 1 · 50667 Köln · Impressum</p></footer>",
    );
    expect(hint.found).toBe(false);
    expect(hint.agencyName).toBeNull();
  });

  it("wertet die Agentur für Arbeit nicht als Webagentur", () => {
    const hint = detect(
      "<footer><p>Gefördert durch die Bundesagentur für Arbeit, Agentur für Arbeit Köln</p></footer>",
    );
    expect(hint.found).toBe(false);
  });

  it("verwirft rein numerische oder leere Namen", () => {
    const hint = detect("<footer>Website by 2024</footer>");
    expect(hint.agencyName).not.toBe("2024");
  });
});

describe("detectAgencyHint – Fundstellen", () => {
  it("findet einen Begriff im Footer ohne konkreten Namen", () => {
    const hint = detect(
      "<footer><p>Konzept und Realisierung: interne Webentwicklung der Gruppe</p></footer>",
    );
    expect(hint.found).toBe(true);
    expect(hint.evidence).toBeTruthy();
  });

  it("prüft auch als Footer markierte Container", () => {
    const hint = detect('<div class="site-footer credits">Website von Atelier Mahler</div>');
    expect(hint.found).toBe(true);
    expect(hint.agencyName).toBe("Atelier Mahler");
  });

  it("kürzt lange Nachweise", () => {
    const hint = detect(`<footer>Website by ${"A".repeat(400)}</footer>`);
    expect((hint.evidence ?? "").length).toBeLessThanOrEqual(230);
  });
});

describe("extractFooterLikeRegions", () => {
  it("schneidet footer-Elemente heraus", () => {
    const regions = extractFooterLikeRegions(
      "<body><main>Hauptinhalt Webdesign</main><footer>Fusszeile</footer></body>",
    );
    expect(regions).toContain("Fusszeile");
  });

  it("fällt auf das Dokumentende zurück", () => {
    const regions = extractFooterLikeRegions("<body><p>Nur Inhalt</p></body>");
    expect(regions).toContain("Nur Inhalt");
  });

  it("ignoriert Skriptinhalte", () => {
    const regions = extractFooterLikeRegions(
      '<footer><script>var a="Webdesign by Böse"</script>Impressum</footer>',
    );
    expect(regions).not.toContain("Böse");
  });
});

describe("detectAgencyHint – Nachweis", () => {
  it("stellt das Label nicht doppelt voran", () => {
    const hint = detect("<footer><span>Umsetzung: Pixelwerk Köln</span></footer>");
    expect(hint.evidence).toBe("Umsetzung: Pixelwerk Köln");
  });

  it("ergänzt das Label, wenn der Text es nicht nennt", () => {
    const hint = detect("<footer><p>Website by Studio Nordlicht</p></footer>");
    expect(hint.evidence).toContain("Studio Nordlicht");
    expect(hint.evidence?.match(/Website by/gi)?.length).toBe(1);
  });
});
