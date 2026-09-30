import type { AgencyHint } from "@/lib/types";
import { decodeEntities, findTags, stripNonContent, visibleText } from "./html";

/**
 * Agentur-Erkennung V1.
 *
 * Wichtig: gefunden wird ausschliesslich ein *Hinweis*. Daraus folgt nicht,
 * dass die Firma aktuell vertraglich an diese Agentur gebunden ist. Die UI
 * formuliert deshalb „Agenturhinweis gefunden".
 */

/** Textmuster, die typischerweise eine Umsetzung durch Dritte ankuendigen. */
const CREDIT_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /(?:website|webseite|seite|web)\s*(?:by|von)\s*[:–-]?\s*([^.,|·•\n]{2,60})/i, label: "Website by" },
  { pattern: /(?:design(?:ed)?|gestaltung)\s*(?:by|von|durch)\s*[:–-]?\s*([^.,|·•\n]{2,60})/i, label: "Designed by" },
  { pattern: /(?:realisiert|realisation|realisierung)\s*(?:durch|von|by)\s*[:–-]?\s*([^.,|·•\n]{2,60})/i, label: "Realisiert durch" },
  { pattern: /(?:umsetzung|technische umsetzung|entwicklung|programmierung)\s*[:–-]?\s*(?:durch|von|by)?\s*([^.,|·•\n]{2,60})/i, label: "Umsetzung" },
  { pattern: /(?:powered|created|developed|built)\s*by\s*[:–-]?\s*([^.,|·•\n]{2,60})/i, label: "Created by" },
  { pattern: /(?:konzept(?:ion)?\s*(?:und|&|u\.)\s*(?:design|umsetzung))\s*[:–-]?\s*(?:durch|von)?\s*([^.,|·•\n]{2,60})/i, label: "Konzept & Umsetzung" },
];

/** Begriffe, die auf eine Webagentur hindeuten – z. B. in Linktexten. */
const AGENCY_TERMS = [
  "webdesign",
  "web-design",
  "webentwicklung",
  "web-entwicklung",
  "webagentur",
  "web-agentur",
  "internetagentur",
  "internet-agentur",
  "digitalagentur",
  "digital-agentur",
  "werbeagentur",
  "fullservice-agentur",
  "online-marketing-agentur",
  "webdevelopment",
  "web development",
  "agentur",
];

/** Begriffe, die keine Agentur sind, aber gerne mitmatchen. */
const FALSE_POSITIVES = [
  "arbeitsagentur",
  "agentur für arbeit",
  "bundesagentur",
  "immobilienagentur",
  "versicherungsagentur",
  "reiseagentur",
  "nachrichtenagentur",
  "modelagentur",
  "presseagentur",
];

/** Plattform-/CMS-Anbieter: kein Hinweis auf eine betreuende Agentur. */
const PLATFORM_CREDITS = [
  "wordpress",
  "wix",
  "jimdo",
  "squarespace",
  "webflow",
  "shopify",
  "woocommerce",
  "shopware",
  "typo3",
  "joomla",
  "drupal",
  "ionos",
  "strato",
  "godaddy",
  "elementor",
  "divi",
  "google",
  "cloudflare",
  "vercel",
  "netlify",
];

const MAX_EVIDENCE_LENGTH = 220;

export type AgencyDetectionInput = {
  html: string;
  /** Endgueltige URL der analysierten Seite. */
  pageUrl: string;
  /** Registrierbare Domain der analysierten Seite, um Eigenlinks zu ignorieren. */
  ownHost: string;
};

export function detectAgencyHint(input: AgencyDetectionInput): AgencyHint {
  const empty: AgencyHint = {
    found: false,
    agencyName: null,
    evidence: null,
    sourceUrl: null,
    location: null,
  };

  const footerHtml = extractFooterLikeRegions(input.html);
  const searchAreas: { html: string; location: string }[] = [
    { html: footerHtml, location: "footer" },
    { html: input.html, location: "seite" },
  ];

  // 1. Credit-Formulierungen im sichtbaren Text („Website by …").
  for (const area of searchAreas) {
    const text = visibleText(area.html);
    if (!text) continue;
    for (const { pattern, label } of CREDIT_PATTERNS) {
      const match = text.match(pattern);
      const candidate = cleanCandidate(match?.[1]);
      if (!match || !candidate) continue;
      if (isPlatformCredit(candidate)) continue;
      return {
        found: true,
        agencyName: candidate,
        evidence: formatEvidence(label, match[0]),
        sourceUrl: input.pageUrl,
        location: area.location,
      };
    }
  }

  // 2. Externe Links, deren Linktext oder Ziel auf eine Agentur hindeutet.
  const linkHint = findAgencyLink(footerHtml || input.html, input);
  if (linkHint) return linkHint;

  // 3. Agenturbegriffe im Fussbereich ohne konkreten Namen.
  const footerText = visibleText(footerHtml);
  const term = AGENCY_TERMS.find(
    (candidate) => footerText.toLowerCase().includes(candidate) && !isFalsePositive(footerText),
  );
  if (term) {
    return {
      found: true,
      agencyName: null,
      evidence: clip(extractSurrounding(footerText, term)),
      sourceUrl: input.pageUrl,
      location: "footer",
    };
  }

  return empty;
}

function findAgencyLink(html: string, input: AgencyDetectionInput): AgencyHint | null {
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) !== null) {
    const attributes = findTags(`<a ${match[1] ?? ""}>`, "a")[0]?.attributes ?? {};
    const href = attributes["href"];
    if (!href) continue;

    let target: URL;
    try {
      target = new URL(href, input.pageUrl);
    } catch {
      continue;
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") continue;
    if (sameSite(target.hostname, input.ownHost)) continue;

    const linkText = decodeEntities((match[2] ?? "").replace(/<[^>]*>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    const title = attributes["title"] ?? "";
    const haystack = `${linkText} ${title} ${target.hostname}`.toLowerCase();

    if (isFalsePositive(haystack)) continue;
    if (PLATFORM_CREDITS.some((platform) => target.hostname.toLowerCase().includes(platform))) continue;

    const term = AGENCY_TERMS.find((candidate) => haystack.includes(candidate));
    if (!term) continue;

    return {
      found: true,
      agencyName: cleanCandidate(linkText) ?? target.hostname.replace(/^www\./, ""),
      evidence: clip(`Link „${linkText || target.hostname}" → ${target.origin}`),
      sourceUrl: input.pageUrl,
      location: "link",
    };
  }
  return null;
}

/** Schneidet footer-, impressum- und credit-Bereiche heraus. */
export function extractFooterLikeRegions(html: string): string {
  const cleaned = stripNonContent(html);
  const regions: string[] = [];

  const footerPattern = /<footer\b[^>]*>([\s\S]*?)<\/footer\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = footerPattern.exec(cleaned)) !== null) {
    regions.push(match[1] ?? "");
  }

  // Container, die per id/class als Footer oder Credits markiert sind.
  const markedPattern =
    /<(div|section|aside|p|span)\b[^>]*(?:id|class)\s*=\s*["'][^"']*(footer|credits?|copyright|impressum|imprint|legal)[^"']*["'][^>]*>([\s\S]{0,4000}?)<\/\1\s*>/gi;
  while ((match = markedPattern.exec(cleaned)) !== null) {
    regions.push(match[3] ?? "");
  }

  if (regions.length === 0) {
    // Fallback: letzte 6000 Zeichen des Dokuments.
    regions.push(cleaned.slice(-6000));
  }

  return regions.join("\n");
}

function sameSite(hostA: string, hostB: string): boolean {
  const a = registrableName(hostA);
  const b = registrableName(hostB);
  return a.length > 0 && a === b;
}

/** Sehr einfache Heuristik: die letzten zwei Labels eines Hostnamens. */
function registrableName(host: string): string {
  const labels = host.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  return labels.slice(-2).join(".");
}

function cleanCandidate(value: string | undefined): string | null {
  if (!value) return null;
  let name = decodeEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s:–—\-|·•]+/, "")
    .replace(/[\s:–—\-|·•]+$/, "")
    .trim();

  // Fuehrende Fuellwoerter entfernen.
  name = name.replace(/^(?:der|die|das|by|von|durch|the|our|unsere?)\s+/i, "").trim();
  if (name.length < 2 || name.length > 60) return null;
  if (/^(?:uns|mir|dir|hier|team)$/i.test(name)) return null;
  // Rein numerische oder symbolische Treffer verwerfen.
  if (!/[a-zA-ZäöüÄÖÜß]/.test(name)) return null;
  return name;
}

function isPlatformCredit(name: string): boolean {
  const lower = name.toLowerCase();
  return PLATFORM_CREDITS.some((platform) => lower.includes(platform));
}

function isFalsePositive(text: string): boolean {
  const lower = text.toLowerCase();
  return FALSE_POSITIVES.some((phrase) => lower.includes(phrase));
}

function extractSurrounding(text: string, term: string): string {
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return text.slice(0, MAX_EVIDENCE_LENGTH);
  const start = Math.max(0, index - 80);
  return text.slice(start, start + MAX_EVIDENCE_LENGTH);
}

/**
 * Nachweis aufbereiten. Das Label wird nur vorangestellt, wenn der gefundene
 * Text es nicht schon selbst enthält – sonst stünde es doppelt da.
 */
function formatEvidence(label: string, matched: string): string {
  const text = clip(matched);
  const firstWord = label.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (firstWord && text.toLowerCase().startsWith(firstWord)) return text;
  return clip(`${label}: ${text}`);
}

function clip(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > MAX_EVIDENCE_LENGTH
    ? `${normalized.slice(0, MAX_EVIDENCE_LENGTH - 1)}…`
    : normalized;
}

/**
 * Sucht unter den internen Links die Impressum-Seite.
 *
 * Nur Pfad-Heuristik, keine zusätzliche Anfrage: der Aufrufer entscheidet, ob
 * die gefundene Adresse wirklich geladen wird.
 */
const IMPRINT_PATH_PATTERN =
  /(^|\/)(impressum|imprint|legal[-_]?notice|anbieterkennzeichnung|kontakt-impressum)(\/|\.|$)/i;

export function findImprintUrl(internalLinks: string[]): string | null {
  for (const link of internalLinks) {
    try {
      const url = new URL(link);
      if (IMPRINT_PATH_PATTERN.test(url.pathname)) return url.toString();
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Wählt den aussagekräftigeren von zwei Hinweisen aus. Ein Hinweis mit Namen
 * gewinnt gegen einen ohne, und ein Treffer gewinnt gegen „nichts gefunden".
 */
export function preferAgencyHint(
  primary: AgencyHint | null,
  secondary: AgencyHint | null,
): AgencyHint | null {
  if (!primary?.found && secondary?.found) return secondary;
  if (primary?.found && secondary?.found && !primary.agencyName && secondary.agencyName) {
    return secondary;
  }
  return primary ?? secondary;
}
