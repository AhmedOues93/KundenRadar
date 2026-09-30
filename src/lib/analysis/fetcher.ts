import { assertPublicUrl, BlockedUrlError } from "./url-guard";

/** Harte Grenzen, damit eine Analyse kalkulierbar bleibt. */
export const LIMITS = {
  /** Timeout pro einzelnem HTTP-Request. */
  requestTimeoutMs: 8_000,
  /** Gesamtbudget für eine Analyse. */
  totalTimeoutMs: 25_000,
  maxRedirects: 5,
  /** Maximal gelesene HTML-Groesse (1,5 MB). */
  maxHtmlBytes: 1_500_000,
  /** Maximal gelesene Nebendatei (robots.txt, sitemap.xml). */
  maxSideFileBytes: 200_000,
  /** Anzahl Links, die auf Erreichbarkeit geprüft wird. */
  maxLinkChecks: 8,
  /** Anzahl Bilder, deren Groesse per HEAD ermittelt wird. */
  maxImageChecks: 8,
  /** Ab dieser Groesse gilt ein Bild als auffällig gross (600 kB). */
  largeImageBytes: 600_000,
} as const;

export const USER_AGENT =
  process.env.KUNDENRADAR_ANALYSIS_USER_AGENT ??
  "KundenRadarBot/1.0 (+https://kundenradar.example/bot)";

export type SafeResponse = {
  finalUrl: string;
  status: number;
  headers: Headers;
  redirectChain: string[];
  body: string;
  truncated: boolean;
  responseTimeMs: number;
};

type SafeFetchOptions = {
  method?: "GET" | "HEAD";
  maxBytes?: number;
  timeoutMs?: number;
  /** Kein Body lesen – nur Status und Header. */
  discardBody?: boolean;
  signal?: AbortSignal;
};

/**
 * Fetch mit SSRF-Schutz. Redirects werden manuell verfolgt und jede
 * Zwischen-URL erneut validiert, damit ein Redirect nicht in ein internes
 * Netz führen kann.
 */
export async function safeFetch(
  input: string,
  options: SafeFetchOptions = {},
): Promise<SafeResponse> {
  const {
    method = "GET",
    maxBytes = LIMITS.maxHtmlBytes,
    timeoutMs = LIMITS.requestTimeoutMs,
    discardBody = false,
    signal,
  } = options;

  const redirectChain: string[] = [];
  let current = (await assertPublicUrl(input)).url;
  const startedAt = Date.now();

  for (let hop = 0; hop <= LIMITS.maxRedirects; hop += 1) {
    redirectChain.push(current.toString());

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onOuterAbort = () => controller.abort();
    signal?.addEventListener("abort", onOuterAbort, { once: true });

    let response: Response;
    try {
      response = await fetch(current, {
        method,
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "de,en;q=0.8",
        },
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new FetchFailedError(
          signal?.aborted
            ? "Die Analyse hat das Zeitbudget überschritten."
            : `Die Anfrage an ${current.host} hat zu lange gedauert.`,
        );
      }
      throw new FetchFailedError(
        `Die Seite ${current.host} konnte nicht abgerufen werden (${describeError(error)}).`,
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onOuterAbort);
    }

    const location = response.headers.get("location");
    if (isRedirect(response.status) && location) {
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new FetchFailedError("Die Seite hat auf eine ungültige Adresse weitergeleitet.");
      }
      // Erneute Validierung – genau hier würde ein SSRF-Redirect ansetzen.
      const checked = await assertPublicUrl(next.toString());
      await response.body?.cancel().catch(() => undefined);
      current = checked.url;
      continue;
    }

    const responseTimeMs = Date.now() - startedAt;
    let body = "";
    let truncated = false;
    if (discardBody || method === "HEAD") {
      await response.body?.cancel().catch(() => undefined);
    } else {
      const read = await readLimited(response, maxBytes);
      body = read.text;
      truncated = read.truncated;
    }

    return {
      finalUrl: current.toString(),
      status: response.status,
      headers: response.headers,
      redirectChain,
      body,
      truncated,
      responseTimeMs,
    };
  }

  throw new FetchFailedError("Die Seite hat zu viele Weiterleitungen.");
}

export class FetchFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchFailedError";
  }
}

export function isBlockedError(error: unknown): error is BlockedUrlError {
  return error instanceof BlockedUrlError;
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code ?? error.message;
  }
  return "unbekannter Fehler";
}

/** Liest den Response-Body, bricht aber nach `maxBytes` ab. */
async function readLimited(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) return { text: "", truncated: false };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (total + value.byteLength > maxBytes) {
        chunks.push(value.subarray(0, Math.max(0, maxBytes - total)));
        total = maxBytes;
        truncated = true;
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const charset = detectCharset(response.headers.get("content-type"));
  let text: string;
  try {
    text = new TextDecoder(charset, { fatal: false }).decode(buffer);
  } catch {
    text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  }
  return { text, truncated };
}

function detectCharset(contentType: string | null): string {
  const match = contentType?.match(/charset=["']?([\w-]+)/i);
  const charset = match?.[1]?.toLowerCase();
  if (!charset) return "utf-8";
  return charset === "iso-8859-1" || charset === "latin1" ? "windows-1252" : charset;
}

/** Ermittelt nur Status (und ggf. Groesse) einer Ressource. */
export async function probe(
  url: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number | null; bytes: number | null }> {
  try {
    const head = await safeFetch(url, {
      method: "HEAD",
      timeoutMs: 5_000,
      discardBody: true,
      signal,
    });
    const length = head.headers.get("content-length");
    return {
      ok: head.status >= 200 && head.status < 400,
      status: head.status,
      bytes: length ? Number.parseInt(length, 10) || null : null,
    };
  } catch {
    return { ok: false, status: null, bytes: null };
  }
}
