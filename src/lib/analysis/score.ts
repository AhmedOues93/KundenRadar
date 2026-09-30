import type { AgencyHint, AnalysisMetrics, Finding } from "@/lib/types";

/**
 * Regelbasierte Bewertung – vollstaendig deterministisch, ohne AI und ohne
 * Zufall. Punkte entstehen ausschliesslich aus nachvollziehbaren technischen
 * Feststellungen und werden in der UI einzeln ausgewiesen.
 *
 * Der Score beantwortet: „Wie interessant erscheint diese Website für eine
 * manuelle Akquise-Prüfung?" – nicht, ob die Firma Kunde wird.
 */

/** Punktwerte an einer Stelle, damit die Gewichtung überprüfbar bleibt. */
export const SCORE_WEIGHTS = {
  httpError: 20,
  noHttps: 14,
  slowResponse: 8,
  moderateResponse: 4,
  manyRedirects: 3,
  titleMissing: 10,
  titleWeak: 4,
  descriptionMissing: 8,
  descriptionWeak: 3,
  h1Missing: 8,
  h1Multiple: 3,
  viewportMissing: 12,
  canonicalMissing: 3,
  robotsMissing: 4,
  sitemapMissing: 6,
  openGraphMissing: 4,
  structuredDataMissing: 5,
  brokenLinkEach: 3,
  brokenLinkMax: 9,
  missingAltMax: 8,
  largeImageEach: 2,
  largeImageMax: 6,
  langMissing: 5,
  thinContent: 4,
} as const;

const OK_SALES_NOTE = "Hier besteht kein Handlungsbedarf – als Gesprächspunkt ungeeignet.";

/** Berechnet Findings und Gesamtscore aus den gemessenen Werten. */
export function evaluate(
  metrics: AnalysisMetrics,
  agencyHint: AgencyHint | null,
): { findings: Finding[]; score: number } {
  const findings: Finding[] = [
    ...technicalFindings(metrics),
    ...seoFindings(metrics),
    ...mobileFindings(metrics),
    ...accessibilityFindings(metrics),
    ...contentFindings(metrics),
    ...agencyFindings(agencyHint, metrics),
  ];

  const raw = findings.reduce((sum, finding) => sum + finding.points, 0);
  return { findings, score: Math.max(0, Math.min(100, Math.round(raw))) };
}

function technicalFindings(m: AnalysisMetrics): Finding[] {
  const findings: Finding[] = [];

  if (m.httpStatus !== null && m.httpStatus >= 400) {
    findings.push({
      id: "technik.http.error",
      group: "TECHNIK",
      severity: "PROBLEM",
      title: `Server antwortet mit Status ${m.httpStatus}`,
      meaning: `Der Aufruf der Startseite liefert den HTTP-Status ${m.httpStatus} statt einer normalen Antwort.`,
      salesRelevance: "Eine nicht korrekt erreichbare Startseite ist ein sachlicher Anlass für eine technische Rückfrage.",
      points: SCORE_WEIGHTS.httpError,
      detail: `HTTP ${m.httpStatus}`,
    });
  } else if (m.httpStatus !== null) {
    findings.push({
      id: "technik.http.ok",
      group: "TECHNIK",
      severity: "OK",
      title: "Startseite ist erreichbar",
      meaning: `Der Server antwortet mit HTTP-Status ${m.httpStatus}.`,
      salesRelevance: OK_SALES_NOTE,
      points: 0,
      detail: `HTTP ${m.httpStatus}`,
    });
  }

  if (!m.https) {
    findings.push({
      id: "technik.https.missing",
      group: "TECHNIK",
      severity: "PROBLEM",
      title: "Keine verschlüsselte Verbindung (HTTPS)",
      meaning: "Die Seite wird nach allen Weiterleitungen über http ausgeliefert, nicht über https.",
      salesRelevance: "Fehlendes HTTPS ist ein klar benennbarer technischer Punkt und in Browsern sichtbar.",
      points: SCORE_WEIGHTS.noHttps,
    });
  } else {
    findings.push({
      id: "technik.https.ok",
      group: "TECHNIK",
      severity: "OK",
      title: "HTTPS ist aktiv",
      meaning: "Die Seite wird verschlüsselt ausgeliefert.",
      salesRelevance: OK_SALES_NOTE,
      points: 0,
    });
  }

  if (m.responseTimeMs !== null) {
    if (m.responseTimeMs > 2_500) {
      findings.push({
        id: "technik.performance.slow",
        group: "TECHNIK",
        severity: "PROBLEM",
        title: "Langsame Server-Antwort",
        meaning: `Die Startseite wurde erst nach ${m.responseTimeMs} ms vollständig geliefert.`,
        salesRelevance: "Messbare Ladezeiten lassen sich im Gespräch konkret belegen.",
        points: SCORE_WEIGHTS.slowResponse,
        detail: `${m.responseTimeMs} ms`,
      });
    } else if (m.responseTimeMs > 1_200) {
      findings.push({
        id: "technik.performance.moderate",
        group: "TECHNIK",
        severity: "HINWEIS",
        title: "Antwortzeit im mittleren Bereich",
        meaning: `Die Startseite brauchte ${m.responseTimeMs} ms. Das ist nicht kritisch, aber verbesserungsfähig.`,
        salesRelevance: "Kann als Nebenaspekt einer technischen Bestandsaufnahme erwähnt werden.",
        points: SCORE_WEIGHTS.moderateResponse,
        detail: `${m.responseTimeMs} ms`,
      });
    } else {
      findings.push({
        id: "technik.performance.ok",
        group: "TECHNIK",
        severity: "OK",
        title: "Schnelle Server-Antwort",
        meaning: `Die Startseite lag nach ${m.responseTimeMs} ms vor.`,
        salesRelevance: OK_SALES_NOTE,
        points: 0,
        detail: `${m.responseTimeMs} ms`,
      });
    }
  }

  if (m.redirectCount > 2) {
    findings.push({
      id: "technik.redirects.many",
      group: "TECHNIK",
      severity: "HINWEIS",
      title: "Mehrere Weiterleitungen bis zur Startseite",
      meaning: `Vom Aufruf bis zur endgültigen Adresse liegen ${m.redirectCount} Weiterleitungen.`,
      salesRelevance: "Weiterleitungsketten sind ein technisches Detail, das bei einem Relaunch ohnehin geprüft wird.",
      points: SCORE_WEIGHTS.manyRedirects,
      detail: `${m.redirectCount} Weiterleitungen`,
    });
  }

  if (m.generator || m.cmsHints.length > 0) {
    const value = m.cmsHints.length > 0 ? m.cmsHints.join(", ") : (m.generator as string);
    findings.push({
      id: "technik.cms.detected",
      group: "TECHNIK",
      severity: "INFO",
      title: "Hinweis auf eingesetztes System",
      meaning: `Im Markup finden sich Spuren von: ${value}.`,
      salesRelevance: "Die technische Basis hilft, ein Gespräch passend vorzubereiten. Sie ist keine Bewertung.",
      points: 0,
      detail: value,
    });
  }

  return findings;
}

function seoFindings(m: AnalysisMetrics): Finding[] {
  const findings: Finding[] = [];
  const title = m.pageTitle?.trim() ?? "";

  if (!title) {
    findings.push({
      id: "seo.title.missing",
      group: "SEO",
      severity: "PROBLEM",
      title: "Titel fehlt",
      meaning: "Die Seite besitzt keinen aussagekräftigen Seitentitel.",
      salesRelevance: "Kann ein sinnvoller Gesprächspunkt bei einer Website-Optimierung sein.",
      points: SCORE_WEIGHTS.titleMissing,
    });
  } else if (title.length < 15 || title.length > 65) {
    findings.push({
      id: "seo.title.weak",
      group: "SEO",
      severity: "HINWEIS",
      title: title.length < 15 ? "Sehr kurzer Seitentitel" : "Sehr langer Seitentitel",
      meaning: `Der Seitentitel hat ${title.length} Zeichen. Übliche Empfehlungen liegen zwischen 15 und 65 Zeichen.`,
      salesRelevance: "Ein Detail, das bei einer SEO-Bestandsaufnahme regelmässig angesprochen wird.",
      points: SCORE_WEIGHTS.titleWeak,
      detail: `${title.length} Zeichen`,
    });
  } else {
    findings.push({
      id: "seo.title.ok",
      group: "SEO",
      severity: "OK",
      title: "Seitentitel vorhanden",
      meaning: `Der Titel lautet „${title}".`,
      salesRelevance: OK_SALES_NOTE,
      points: 0,
      detail: `${title.length} Zeichen`,
    });
  }

  const description = m.metaDescription?.trim() ?? "";
  if (!description) {
    findings.push({
      id: "seo.description.missing",
      group: "SEO",
      severity: "PROBLEM",
      title: "Meta-Description fehlt",
      meaning: "Es ist keine Kurzbeschreibung hinterlegt, die Suchmaschinen anzeigen können.",
      salesRelevance: "Lässt sich gut zeigen: in Suchergebnissen erscheint dann ein automatisch gewählter Textausschnitt.",
      points: SCORE_WEIGHTS.descriptionMissing,
    });
  } else if (description.length < 50 || description.length > 170) {
    findings.push({
      id: "seo.description.weak",
      group: "SEO",
      severity: "HINWEIS",
      title: "Meta-Description mit auffälliger Länge",
      meaning: `Die Beschreibung hat ${description.length} Zeichen. Übliche Empfehlungen liegen zwischen 50 und 170 Zeichen.`,
      salesRelevance: "Kleiner, leicht korrigierbarer Punkt in einer SEO-Bestandsaufnahme.",
      points: SCORE_WEIGHTS.descriptionWeak,
      detail: `${description.length} Zeichen`,
    });
  } else {
    findings.push({
      id: "seo.description.ok",
      group: "SEO",
      severity: "OK",
      title: "Meta-Description vorhanden",
      meaning: "Eine Kurzbeschreibung für Suchmaschinen ist hinterlegt.",
      salesRelevance: OK_SALES_NOTE,
      points: 0,
      detail: `${description.length} Zeichen`,
    });
  }

  if (!m.canonical) {
    findings.push({
      id: "seo.canonical.missing",
      group: "SEO",
      severity: "HINWEIS",
      title: "Kein Canonical-Tag",
      meaning: "Die Seite gibt keine bevorzugte Adresse an.",
      salesRelevance: "Technischer Punkt, der bei Umzügen und Relaunches ohnehin geprüft werden muss.",
      points: SCORE_WEIGHTS.canonicalMissing,
    });
  }

  if (!m.robotsTxt) {
    findings.push({
      id: "seo.robots.missing",
      group: "SEO",
      severity: "HINWEIS",
      title: "Keine robots.txt gefunden",
      meaning: "Unter /robots.txt liegt keine abrufbare Datei.",
      salesRelevance: "Deutet darauf hin, dass die Seite technisch nicht aktiv betreut wird.",
      points: SCORE_WEIGHTS.robotsMissing,
    });
  }

  if (!m.sitemapXml) {
    findings.push({
      id: "seo.sitemap.missing",
      group: "SEO",
      severity: "PROBLEM",
      title: "Keine sitemap.xml gefunden",
      meaning: "Unter /sitemap.xml und in der robots.txt ist keine Sitemap hinterlegt.",
      salesRelevance: "Häufig ein Zeichen für eine Website ohne laufende technische Pflege.",
      points: SCORE_WEIGHTS.sitemapMissing,
    });
  }

  const hasOpenGraph = Boolean(m.openGraph.title || m.openGraph.description || m.openGraph.image);
  if (!hasOpenGraph) {
    findings.push({
      id: "seo.opengraph.missing",
      group: "SEO",
      severity: "HINWEIS",
      title: "Keine Open-Graph-Daten",
      meaning: "Beim Teilen in sozialen Netzwerken oder Messengern fehlen Titel, Beschreibung und Vorschaubild.",
      salesRelevance: "Gut demonstrierbar, indem man den Link in einem Messenger einfügt.",
      points: SCORE_WEIGHTS.openGraphMissing,
    });
  }

  if (!m.structuredData) {
    findings.push({
      id: "seo.structured-data.missing",
      group: "SEO",
      severity: "HINWEIS",
      title: "Keine strukturierten Daten",
      meaning: "Es wurden keine strukturierten Daten (JSON-LD, Microdata oder RDFa) gefunden.",
      salesRelevance: "Für lokale Unternehmen oft ein konkreter Ansatzpunkt, z. B. Öffnungszeiten und Adresse.",
      points: SCORE_WEIGHTS.structuredDataMissing,
    });
  }

  return findings;
}

function mobileFindings(m: AnalysisMetrics): Finding[] {
  if (!m.hasViewport) {
    return [
      {
        id: "mobile.viewport.missing",
        group: "MOBILE",
        severity: "PROBLEM",
        title: "Kein Viewport-Meta-Tag",
        meaning: "Ohne Viewport-Angabe stellen mobile Browser die Seite in Desktop-Breite dar und zoomen heraus.",
        salesRelevance: "Auf einem Smartphone unmittelbar sichtbar und damit gut im Gespräch zeigbar.",
        points: SCORE_WEIGHTS.viewportMissing,
      },
    ];
  }
  return [
    {
      id: "mobile.viewport.ok",
      group: "MOBILE",
      severity: "OK",
      title: "Viewport-Meta-Tag vorhanden",
      meaning: "Die Seite gibt eine Viewport-Konfiguration für mobile Geräte an.",
      salesRelevance: OK_SALES_NOTE,
      points: 0,
    },
  ];
}

function accessibilityFindings(m: AnalysisMetrics): Finding[] {
  const findings: Finding[] = [];

  if (!m.langAttribute) {
    findings.push({
      id: "a11y.lang.missing",
      group: "ACCESSIBILITY",
      severity: "PROBLEM",
      title: "Sprachangabe fehlt",
      meaning: "Das <html>-Element besitzt kein lang-Attribut. Screenreader können die Sprache nicht bestimmen.",
      salesRelevance: "Kleiner technischer Punkt, der bei Barrierefreiheits-Themen regelmässig aufkommt.",
      points: SCORE_WEIGHTS.langMissing,
    });
  } else {
    findings.push({
      id: "a11y.lang.ok",
      group: "ACCESSIBILITY",
      severity: "OK",
      title: "Sprachangabe vorhanden",
      meaning: `Die Seite ist als „${m.langAttribute}" gekennzeichnet.`,
      salesRelevance: OK_SALES_NOTE,
      points: 0,
      detail: m.langAttribute,
    });
  }

  if (m.imageCount > 0) {
    if (m.imagesWithoutAlt > 0) {
      const ratio = m.imagesWithoutAlt / m.imageCount;
      const points = Math.min(
        SCORE_WEIGHTS.missingAltMax,
        Math.ceil(ratio * SCORE_WEIGHTS.missingAltMax),
      );
      findings.push({
        id: "a11y.images.alt-missing",
        group: "ACCESSIBILITY",
        severity: ratio >= 0.5 ? "PROBLEM" : "HINWEIS",
        title: "Bilder ohne Alternativtext",
        meaning: `${m.imagesWithoutAlt} von ${m.imageCount} Bildern haben kein alt-Attribut.`,
        salesRelevance: "Alternativtexte sind sowohl für Barrierefreiheit als auch für die Bildsuche relevant.",
        points,
        detail: `${m.imagesWithoutAlt} von ${m.imageCount} Bildern`,
      });
    } else {
      findings.push({
        id: "a11y.images.alt-ok",
        group: "ACCESSIBILITY",
        severity: "OK",
        title: "Alle geprüften Bilder haben Alternativtexte",
        meaning: `${m.imageCount} Bilder wurden geprüft, alle besitzen ein alt-Attribut.`,
        salesRelevance: OK_SALES_NOTE,
        points: 0,
        detail: `${m.imageCount} Bilder`,
      });
    }
  }

  return findings;
}

function contentFindings(m: AnalysisMetrics): Finding[] {
  const findings: Finding[] = [];

  if (m.h1Count === 0) {
    findings.push({
      id: "content.h1.missing",
      group: "CONTENT",
      severity: "PROBLEM",
      title: "Keine H1-Überschrift",
      meaning: "Die Seite besitzt keine Hauptüberschrift, die das Thema benennt.",
      salesRelevance: "Gehört zu den Grundlagen der Seitenstruktur und ist schnell nachvollziehbar.",
      points: SCORE_WEIGHTS.h1Missing,
    });
  } else if (m.h1Count > 1) {
    findings.push({
      id: "content.h1.multiple",
      group: "CONTENT",
      severity: "HINWEIS",
      title: "Mehrere H1-Überschriften",
      meaning: `Es wurden ${m.h1Count} H1-Überschriften gefunden. Üblich ist eine pro Seite.`,
      salesRelevance: "Hinweis auf eine gewachsene Seitenstruktur. Kein kritischer Punkt.",
      points: SCORE_WEIGHTS.h1Multiple,
      detail: `${m.h1Count} H1-Elemente`,
    });
  } else {
    findings.push({
      id: "content.h1.ok",
      group: "CONTENT",
      severity: "OK",
      title: "H1-Überschrift vorhanden",
      meaning: m.h1 ? `Die Hauptüberschrift lautet „${m.h1}".` : "Die Seite besitzt eine Hauptüberschrift.",
      salesRelevance: OK_SALES_NOTE,
      points: 0,
    });
  }

  if (m.brokenLinks.length > 0) {
    const points = Math.min(
      SCORE_WEIGHTS.brokenLinkMax,
      m.brokenLinks.length * SCORE_WEIGHTS.brokenLinkEach,
    );
    findings.push({
      id: "content.links.broken",
      group: "CONTENT",
      severity: "PROBLEM",
      title: "Nicht erreichbare Links",
      meaning: `Von ${m.checkedLinks} geprüften Links waren ${m.brokenLinks.length} nicht erreichbar.`,
      salesRelevance: "Konkret belegbar und für den Gesprächspartner leicht nachzuvollziehen.",
      points,
      detail: m.brokenLinks
        .slice(0, 3)
        .map((link) => `${link.url}${link.status ? ` (${link.status})` : ""}`)
        .join(", "),
    });
  } else if (m.checkedLinks > 0) {
    findings.push({
      id: "content.links.ok",
      group: "CONTENT",
      severity: "OK",
      title: "Geprüfte Links erreichbar",
      meaning: `Alle ${m.checkedLinks} stichprobenartig geprüften Links antworten.`,
      salesRelevance: OK_SALES_NOTE,
      points: 0,
      detail: `${m.checkedLinks} Links geprüft`,
    });
  }

  if (m.largeImages.length > 0) {
    const points = Math.min(
      SCORE_WEIGHTS.largeImageMax,
      m.largeImages.length * SCORE_WEIGHTS.largeImageEach,
    );
    findings.push({
      id: "content.images.large",
      group: "CONTENT",
      severity: "HINWEIS",
      title: "Auffällig grosse Bilddateien",
      meaning: `${m.largeImages.length} geprüfte Bilder sind grösser als ${Math.round(600)} kB.`,
      salesRelevance: "Bildoptimierung ist ein üblicher, gut umsetzbarer erster Schritt.",
      points,
      detail: m.largeImages
        .slice(0, 3)
        .map((image) => `${shortenUrl(image.url)} (${Math.round(image.bytes / 1024)} kB)`)
        .join(", "),
    });
  }

  if (m.htmlBytes > 0 && m.htmlBytes < 4_000) {
    findings.push({
      id: "content.thin",
      group: "CONTENT",
      severity: "HINWEIS",
      title: "Sehr wenig Seiteninhalt",
      meaning: `Das ausgelieferte HTML umfasst nur ${Math.round(m.htmlBytes / 1024)} kB. Das kann auf eine Platzhalterseite hindeuten.`,
      salesRelevance: "Platzhalter- und Baustellenseiten sind ein sachlicher Anlass für eine Kontaktaufnahme.",
      points: SCORE_WEIGHTS.thinContent,
      detail: `${Math.round(m.htmlBytes / 1024)} kB HTML`,
    });
  }

  findings.push({
    id: "content.links.count",
    group: "CONTENT",
    severity: "INFO",
    title: "Verlinkung der Startseite",
    meaning: `Die Startseite enthält ${m.internalLinks} interne und ${m.externalLinks} externe Links.`,
    salesRelevance: "Reiner Messwert zur Einordnung des Seitenumfangs.",
    points: 0,
    detail: `${m.internalLinks} intern / ${m.externalLinks} extern`,
  });

  return findings;
}

function agencyFindings(agencyHint: AgencyHint | null, m: AnalysisMetrics): Finding[] {
  // Agenturhinweise sind bewusst mit 0 Punkten bewertet: der Score soll
  // ausschliesslich technische Feststellungen abbilden.
  if (agencyHint?.found) {
    const name = agencyHint.agencyName;
    return [
      {
        id: "agency.hint.found",
        group: "AGENCY",
        severity: "INFO",
        title: name ? `Agenturhinweis gefunden: ${name}` : "Agenturhinweis gefunden",
        meaning:
          "Auf der Seite wurde ein Hinweis auf eine Webagentur gefunden. Daraus folgt nicht, dass eine laufende Zusammenarbeit besteht.",
        salesRelevance:
          "Vor einer Kontaktaufnahme lohnt eine manuelle Prüfung, wie aktuell dieser Hinweis ist.",
        points: 0,
        detail: agencyHint.evidence ?? undefined,
      },
    ];
  }

  return [
    {
      id: "agency.hint.none",
      group: "AGENCY",
      severity: "INFO",
      title: "Kein Agenturhinweis gefunden",
      meaning: `In den geprüften Bereichen von ${m.htmlBytes > 0 ? "der Startseite" : "der Seite"} wurde kein Hinweis auf eine Webagentur gefunden.`,
      salesRelevance:
        "Ein fehlender Hinweis ist kein Beweis dafür, dass keine Agentur betreut wird – er sagt nur, dass nichts sichtbar genannt wird.",
      points: 0,
    },
  ];
}

function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const file = parsed.pathname.split("/").filter(Boolean).pop() ?? parsed.pathname;
    return file.length > 40 ? `${file.slice(0, 39)}…` : file;
  } catch {
    return url.length > 40 ? `${url.slice(0, 39)}…` : url;
  }
}
