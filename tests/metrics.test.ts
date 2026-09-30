import { describe, expect, it } from "vitest";
import { extractFromHtml, sitemapFromRobots } from "@/lib/analysis/metrics";
import { detectCmsHints, hasStructuredData, visibleText } from "@/lib/analysis/html";

const PAGE = `<!doctype html>
<html lang="de-DE">
  <head>
    <title>Musterfirma – Sanitär &amp; Heizung in Köln</title>
    <meta name="description" content="Wir sind Ihr Fachbetrieb für Sanitär und Heizung im Raum Köln und beraten Sie gerne persönlich." />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="generator" content="WordPress 6.4" />
    <meta property="og:title" content="Musterfirma" />
    <link rel="canonical" href="/start" />
    <script type="application/ld+json">{"@type":"LocalBusiness"}</script>
  </head>
  <body>
    <h1>Ihr Fachbetrieb in Köln</h1>
    <a href="/leistungen">Leistungen</a>
    <a href="/leistungen#anker">Leistungen erneut</a>
    <a href="https://partner.example/info">Partner</a>
    <a href="mailto:info@musterfirma.de">Mail</a>
    <a href="#top">Nach oben</a>
    <img src="/bild1.jpg" alt="Badumbau" />
    <img src="/bild2.jpg" />
    <img src="data:image/gif;base64,R0lGOD" alt="" />
    <script>var x = "<h1>nicht zählen</h1>";</script>
  </body>
</html>`;

describe("extractFromHtml", () => {
  const { metrics, links, imageUrls } = extractFromHtml(PAGE, "https://musterfirma.de/");

  it("liest Titel, Beschreibung und H1", () => {
    expect(metrics.pageTitle).toBe("Musterfirma – Sanitär & Heizung in Köln");
    expect(metrics.metaDescription).toContain("Fachbetrieb für Sanitär");
    expect(metrics.h1).toBe("Ihr Fachbetrieb in Köln");
  });

  it("zählt H1-Elemente in Skripten nicht mit", () => {
    expect(metrics.h1Count).toBe(1);
  });

  it("erkennt Viewport, Sprache und strukturierte Daten", () => {
    expect(metrics.hasViewport).toBe(true);
    expect(metrics.langAttribute).toBe("de-DE");
    expect(metrics.structuredData).toBe(true);
  });

  it("löst das Canonical absolut auf", () => {
    expect(metrics.canonical).toBe("https://musterfirma.de/start");
  });

  it("liest Open-Graph-Daten", () => {
    expect(metrics.openGraph.title).toBe("Musterfirma");
    expect(metrics.openGraph.description).toBeNull();
  });

  it("trennt interne von externen Links und entfernt Dubletten", () => {
    expect(metrics.internalLinks).toBe(1);
    expect(metrics.externalLinks).toBe(1);
    expect(links.internal).toEqual(["https://musterfirma.de/leistungen"]);
    expect(links.external).toEqual(["https://partner.example/info"]);
  });

  it("zählt Bilder und fehlende Alternativtexte", () => {
    expect(metrics.imageCount).toBe(3);
    // alt="" gilt als vorhanden (dekoratives Bild); nur bild2 fehlt es.
    expect(metrics.imagesWithoutAlt).toBe(1);
    expect(imageUrls).toEqual([
      "https://musterfirma.de/bild1.jpg",
      "https://musterfirma.de/bild2.jpg",
    ]);
  });

  it("erkennt das eingesetzte CMS", () => {
    expect(metrics.cmsHints).toContain("WordPress");
  });
});

describe("extractFromHtml – leere Seite", () => {
  it("meldet fehlende Angaben statt zu werfen", () => {
    const { metrics } = extractFromHtml("<html><body><p>Hallo</p></body></html>", "http://x.de/");
    expect(metrics.pageTitle).toBeNull();
    expect(metrics.metaDescription).toBeNull();
    expect(metrics.h1Count).toBe(0);
    expect(metrics.hasViewport).toBe(false);
    expect(metrics.langAttribute).toBeNull();
    expect(metrics.structuredData).toBe(false);
    expect(metrics.imageCount).toBe(0);
  });

  it("ignoriert ein ungültiges lang-Attribut", () => {
    const { metrics } = extractFromHtml('<html lang=" "><head></head></html>', "http://x.de/");
    expect(metrics.langAttribute).toBeNull();
  });
});

describe("hasStructuredData", () => {
  it("erkennt JSON-LD, Microdata und RDFa", () => {
    expect(hasStructuredData('<script type="application/ld+json">{}</script>')).toBe(true);
    expect(hasStructuredData('<div itemscope itemtype="https://schema.org/Thing"></div>')).toBe(true);
    expect(hasStructuredData('<div vocab="https://schema.org/"></div>')).toBe(true);
    expect(hasStructuredData("<div>nichts</div>")).toBe(false);
  });
});

describe("visibleText", () => {
  it("entfernt Skripte, Stile und Kommentare", () => {
    const text = visibleText(
      "<style>p{color:red}</style><!-- weg --><p>Hallo&nbsp;Welt</p><script>var a=1</script>",
    );
    expect(text).toBe("Hallo Welt");
  });
});

describe("detectCmsHints", () => {
  it("erkennt bekannte Systeme", () => {
    expect(detectCmsHints('<link href="/wp-content/style.css">', null)).toContain("WordPress");
    expect(detectCmsHints("<div>", "TYPO3 CMS 12")).toContain("TYPO3");
    expect(detectCmsHints("<div>nichts</div>", null)).toEqual([]);
  });
});

describe("sitemapFromRobots", () => {
  it("liest den Sitemap-Verweis", () => {
    expect(sitemapFromRobots("User-agent: *\nSitemap: https://x.de/sitemap_index.xml\n")).toBe(
      "https://x.de/sitemap_index.xml",
    );
    expect(sitemapFromRobots("User-agent: *\nDisallow:\n")).toBeNull();
  });
});
