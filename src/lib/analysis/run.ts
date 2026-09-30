import type { AgencyHint, AnalysisMetrics, AnalysisResult } from "@/lib/types";
import { detectAgencyHint, findImprintUrl, preferAgencyHint } from "./agency";
import { FetchFailedError, LIMITS, isBlockedError, probe, safeFetch } from "./fetcher";
import { extractFromHtml, sitemapFromRobots } from "./metrics";
import { evaluate } from "./score";
import { BlockedUrlError, normalizeUrl } from "./url-guard";

/**
 * Fuehrt die Website-Analyse V1 aus.
 *
 * Bewusst *kein* Crawler: es wird die Startseite geladen, dazu robots.txt und
 * sitemap.xml geprüft und eine begrenzte Stichprobe von Links und Bildern
 * kontrolliert. Alle Grenzen stehen in `LIMITS`.
 */
export async function analyzeWebsite(inputUrl: string): Promise<AnalysisResult> {
  const budget = AbortSignal.timeout(LIMITS.totalTimeoutMs);

  let requested: string;
  try {
    requested = normalizeUrl(inputUrl).toString();
  } catch (error) {
    return failure(inputUrl, error, "BLOCKED");
  }

  let page;
  try {
    page = await safeFetch(requested, { signal: budget });
  } catch (error) {
    return failure(requested, error, isBlockedError(error) ? "BLOCKED" : "FAILED");
  }

  const finalUrl = page.finalUrl;
  const finalParsed = new URL(finalUrl);
  const domain = finalParsed.hostname.replace(/^www\./, "");

  const extraction = extractFromHtml(page.body, finalUrl);

  const [sideFiles, linkChecks, imageChecks] = await Promise.all([
    checkSideFiles(finalParsed, budget),
    checkLinks(extraction.links, budget),
    checkImages(extraction.imageUrls, budget),
  ]);

  const metrics: AnalysisMetrics = {
    ...extraction.metrics,
    httpStatus: page.status,
    https: finalParsed.protocol === "https:",
    redirectCount: Math.max(0, page.redirectChain.length - 1),
    redirectChain: page.redirectChain,
    responseTimeMs: page.responseTimeMs,
    robotsTxt: sideFiles.robotsTxt,
    sitemapXml: sideFiles.sitemapXml,
    checkedLinks: linkChecks.checked,
    brokenLinks: linkChecks.broken,
    largeImages: imageChecks.large,
  };

  const startPageHint = detectAgencyHint({
    html: page.body,
    pageUrl: finalUrl,
    ownHost: finalParsed.hostname,
  });

  // Nur wenn auf der Startseite kein Hinweis steht, wird zusätzlich das
  // Impressum geprüft – eine einzige weitere Anfrage, über denselben
  // SSRF-geschützten Fetch.
  const agencyHint = startPageHint.found
    ? startPageHint
    : preferAgencyHint(
        startPageHint,
        await checkImprint(extraction.links.internal, finalParsed.hostname, budget),
      );

  const { findings, score } = evaluate(metrics, agencyHint);

  return {
    requestedUrl: requested,
    finalUrl,
    domain,
    status: "SUCCESS",
    errorMessage: null,
    score,
    findings,
    metrics,
    agencyHint,
  };
}

async function checkSideFiles(
  base: URL,
  signal: AbortSignal,
): Promise<{ robotsTxt: boolean; sitemapXml: boolean }> {
  let robotsTxt = false;
  let sitemapFromRobotsTxt: string | null = null;

  try {
    const response = await safeFetch(new URL("/robots.txt", base).toString(), {
      maxBytes: LIMITS.maxSideFileBytes,
      timeoutMs: 5_000,
      signal,
    });
    // Viele Server liefern bei fehlender Datei eine HTML-Fehlerseite mit 200.
    robotsTxt =
      response.status >= 200 &&
      response.status < 300 &&
      !/^\s*<(?:!doctype|html)/i.test(response.body) &&
      /(?:user-agent|disallow|allow|sitemap)\s*:/i.test(response.body);
    if (robotsTxt) sitemapFromRobotsTxt = sitemapFromRobots(response.body);
  } catch {
    robotsTxt = false;
  }

  const sitemapCandidates = [
    sitemapFromRobotsTxt,
    new URL("/sitemap.xml", base).toString(),
    new URL("/sitemap_index.xml", base).toString(),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of sitemapCandidates) {
    try {
      const response = await safeFetch(candidate, {
        maxBytes: LIMITS.maxSideFileBytes,
        timeoutMs: 5_000,
        signal,
      });
      if (
        response.status >= 200 &&
        response.status < 300 &&
        /<(?:urlset|sitemapindex)\b/i.test(response.body)
      ) {
        return { robotsTxt, sitemapXml: true };
      }
    } catch {
      // Naechsten Kandidaten versuchen.
    }
  }

  return { robotsTxt, sitemapXml: false };
}

async function checkLinks(
  links: { internal: string[]; external: string[] },
  signal: AbortSignal,
): Promise<{ checked: number; broken: { url: string; status: number | null }[] }> {
  // Stichprobe: bevorzugt interne Links, aufgefuellt mit externen.
  const sample = [...links.internal.slice(0, LIMITS.maxLinkChecks)];
  for (const external of links.external) {
    if (sample.length >= LIMITS.maxLinkChecks) break;
    sample.push(external);
  }
  if (sample.length === 0) return { checked: 0, broken: [] };

  const results = await Promise.all(
    sample.map(async (url) => ({ url, result: await probe(url, signal) })),
  );

  const broken = results
    .filter(({ result }) => !result.ok)
    .map(({ url, result }) => ({ url, status: result.status }));

  return { checked: sample.length, broken };
}

async function checkImages(
  imageUrls: string[],
  signal: AbortSignal,
): Promise<{ large: { url: string; bytes: number }[] }> {
  const sample = imageUrls.slice(0, LIMITS.maxImageChecks);
  if (sample.length === 0) return { large: [] };

  const results = await Promise.all(
    sample.map(async (url) => ({ url, result: await probe(url, signal) })),
  );

  const large = results
    .filter(({ result }) => (result.bytes ?? 0) >= LIMITS.largeImageBytes)
    .map(({ url, result }) => ({ url, bytes: result.bytes as number }));

  return { large };
}

/**
 * Laedt die Impressum-Seite und sucht dort nach einem Agenturhinweis.
 * Schlaegt das fehl, ist das kein Fehler der Analyse – es gibt dann einfach
 * keinen zusaetzlichen Hinweis.
 */
async function checkImprint(
  internalLinks: string[],
  ownHost: string,
  signal: AbortSignal,
): Promise<AgencyHint | null> {
  if (LIMITS.maxAgencyPages < 1) return null;

  const imprintUrl = findImprintUrl(internalLinks);
  if (!imprintUrl) return null;

  try {
    const page = await safeFetch(imprintUrl, { signal, timeoutMs: 6_000 });
    if (page.status < 200 || page.status >= 300) return null;
    const hint = detectAgencyHint({
      html: page.body,
      pageUrl: page.finalUrl,
      ownHost,
    });
    // Fundstelle kennzeichnen, damit in der UI sichtbar ist, woher der
    // Hinweis stammt.
    return hint.found ? { ...hint, location: `impressum/${hint.location ?? "seite"}` } : hint;
  } catch {
    return null;
  }
}

function failure(
  requestedUrl: string,
  error: unknown,
  status: "FAILED" | "BLOCKED",
): AnalysisResult {
  const message =
    error instanceof BlockedUrlError || error instanceof FetchFailedError
      ? error.message
      : "Die Analyse konnte nicht durchgeführt werden.";

  return {
    requestedUrl,
    finalUrl: null,
    domain: null,
    status,
    errorMessage: message,
    score: null,
    findings: [],
    metrics: null,
    agencyHint: null,
  };
}

/** Domain aus einer Nutzereingabe ableiten, z. B. für die Lead-Erfassung. */
export function domainFromInput(input: string): string | null {
  try {
    return normalizeUrl(input).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
