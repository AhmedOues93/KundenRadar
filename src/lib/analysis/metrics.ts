import type { AnalysisMetrics } from "@/lib/types";
import {
  detectCmsHints,
  findElementTexts,
  findTags,
  hasStructuredData,
  linkHref,
  metaContent,
  stripNonContent,
} from "./html";

/** Aus HTML ableitbare Messwerte – ohne Netzwerkzugriff und damit gut testbar. */
export type StaticMetrics = Omit<
  AnalysisMetrics,
  | "httpStatus"
  | "https"
  | "redirectCount"
  | "redirectChain"
  | "responseTimeMs"
  | "robotsTxt"
  | "sitemapXml"
  | "checkedLinks"
  | "brokenLinks"
  | "largeImages"
>;

export type ExtractedLinks = {
  internal: string[];
  external: string[];
};

export type Extraction = {
  metrics: StaticMetrics;
  links: ExtractedLinks;
  imageUrls: string[];
};

const IGNORED_LINK_PROTOCOLS = ["mailto:", "tel:", "javascript:", "data:", "sms:", "fax:", "ftp:"];

export function extractFromHtml(html: string, pageUrl: string): Extraction {
  const head = html.slice(0, 200_000);
  const title = firstText(findElementTexts(head, "title"));
  // Skript- und Stilbloecke zuerst entfernen, damit dort notiertes Markup
  // (z. B. ein H1 in einem JS-Template) nicht mitgezaehlt wird.
  const content = stripNonContent(html);
  const h1s = findElementTexts(content, "h1").filter((text) => text.length > 0);
  const htmlTag = findTags(head, "html")[0];
  const generator = metaContent(head, "generator");

  const viewport = metaContent(head, "viewport");
  const canonical = linkHref(head, "canonical");

  const { links, internal, external } = collectLinks(content, pageUrl);
  const { imageUrls, imageCount, imagesWithoutAlt } = collectImages(content, pageUrl);

  const metrics: StaticMetrics = {
    pageTitle: title,
    metaDescription: metaContent(head, "description"),
    h1: h1s[0] ?? null,
    h1Count: h1s.length,
    hasViewport: Boolean(viewport),
    canonical: canonical ? absolutize(canonical, pageUrl) : null,
    langAttribute: normalizeLang(htmlTag?.attributes["lang"]),
    generator,
    cmsHints: detectCmsHints(html, generator),
    openGraph: {
      title: metaContent(head, "og:title"),
      description: metaContent(head, "og:description"),
      image: metaContent(head, "og:image"),
    },
    structuredData: hasStructuredData(html),
    internalLinks: internal,
    externalLinks: external,
    imageCount,
    imagesWithoutAlt,
    htmlBytes: Buffer.byteLength(html, "utf8"),
  };

  return { metrics, links, imageUrls };
}

function firstText(values: string[]): string | null {
  const value = values.find((candidate) => candidate.trim().length > 0);
  return value ? value.trim() : null;
}

function normalizeLang(value: string | undefined): string | null {
  const lang = value?.trim();
  if (!lang) return null;
  return /^[a-zA-Z]{2,3}(?:[-_][a-zA-Z0-9]{2,8})*$/.test(lang) ? lang : null;
}

function collectLinks(
  content: string,
  pageUrl: string,
): { links: ExtractedLinks; internal: number; external: number } {
  const body = content;
  const base = safeUrl(pageUrl);
  const internalUrls: string[] = [];
  const externalUrls: string[] = [];
  const seen = new Set<string>();

  for (const tag of findTags(body, "a")) {
    const href = tag.attributes["href"]?.trim();
    if (!href || href.startsWith("#")) continue;
    if (IGNORED_LINK_PROTOCOLS.some((protocol) => href.toLowerCase().startsWith(protocol))) continue;

    const resolved = base ? safeUrl(href, base) : null;
    if (!resolved) continue;
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;

    resolved.hash = "";
    const key = resolved.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    if (base && sameHost(resolved.hostname, base.hostname)) internalUrls.push(key);
    else externalUrls.push(key);
  }

  return {
    links: { internal: internalUrls, external: externalUrls },
    internal: internalUrls.length,
    external: externalUrls.length,
  };
}

function collectImages(
  content: string,
  pageUrl: string,
): { imageUrls: string[]; imageCount: number; imagesWithoutAlt: number } {
  const body = content;
  const base = safeUrl(pageUrl);
  const imageUrls: string[] = [];
  const seen = new Set<string>();
  let imageCount = 0;
  let imagesWithoutAlt = 0;

  for (const tag of findTags(body, "img")) {
    const src = tag.attributes["src"]?.trim() ?? tag.attributes["data-src"]?.trim();
    // `alt=""` ist gültig (dekoratives Bild) und zählt daher als vorhanden.
    const hasAlt = Object.prototype.hasOwnProperty.call(tag.attributes, "alt");
    imageCount += 1;
    if (!hasAlt) imagesWithoutAlt += 1;

    if (!src || src.startsWith("data:")) continue;
    const resolved = base ? safeUrl(src, base) : null;
    if (!resolved) continue;
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
    const key = resolved.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    imageUrls.push(key);
  }

  return { imageUrls, imageCount, imagesWithoutAlt };
}

function sameHost(a: string, b: string): boolean {
  return a.toLowerCase().replace(/^www\./, "") === b.toLowerCase().replace(/^www\./, "");
}

function safeUrl(input: string, base?: URL): URL | null {
  try {
    return base ? new URL(input, base) : new URL(input);
  } catch {
    return null;
  }
}

function absolutize(input: string, pageUrl: string): string {
  const base = safeUrl(pageUrl);
  const resolved = base ? safeUrl(input, base) : safeUrl(input);
  return resolved ? resolved.toString() : input;
}

/** Liest Sitemap-Verweise aus einer robots.txt. */
export function sitemapFromRobots(robotsTxt: string): string | null {
  const match = robotsTxt.match(/^\s*sitemap\s*:\s*(\S+)/im);
  return match?.[1] ?? null;
}
