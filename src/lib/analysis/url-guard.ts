import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Schutz gegen SSRF.
 *
 * Nutzer geben beliebige URLs ein. Bevor irgendetwas abgerufen wird, muss
 * sichergestellt sein, dass die URL auf eine oeffentliche Internet-Adresse
 * zeigt – und zwar bei jedem Redirect erneut.
 */

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Hostnamen, die nie aufgeloest werden duerfen. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "kubernetes",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

/** Interne bzw. nicht oeffentlich aufloesbare Top-Level-Suffixe. */
const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".corp",
  ".private",
  ".test",
  ".example",
  ".invalid",
  ".onion",
  ".svc",
  ".cluster.local",
];

/**
 * Normalisiert eine Nutzereingabe zu einer absoluten http(s)-URL.
 * Wirft `BlockedUrlError`, wenn die Eingabe strukturell unbrauchbar ist.
 */
export function normalizeUrl(input: string): URL {
  const raw = (input ?? "").trim();
  if (!raw) throw new BlockedUrlError("Es wurde keine URL angegeben.");
  if (raw.length > 2048) throw new BlockedUrlError("Die URL ist zu lang.");

  // Schema ergaenzen, damit „example.com" akzeptiert wird.
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new BlockedUrlError("Die URL konnte nicht gelesen werden.");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new BlockedUrlError("Es sind nur http- und https-Adressen erlaubt.");
  }
  if (url.username || url.password) {
    throw new BlockedUrlError("URLs mit Benutzername oder Passwort sind nicht erlaubt.");
  }
  if (url.port && !["", "80", "443", "8080", "8443"].includes(url.port)) {
    throw new BlockedUrlError(`Der Port ${url.port} ist für Analysen nicht freigegeben.`);
  }

  url.hash = "";
  return url;
}

/** Reine Hostnamen-Pruefung ohne DNS – gut testbar. */
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  // Hostname ohne Punkt ist in der Regel ein interner Name (z. B. „db", „redis").
  const isIpLiteral = net.isIP(stripBrackets(host)) !== 0;
  if (!isIpLiteral && !host.includes(".")) return true;
  return false;
}

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

function ipv4ToParts(ip: string): number[] | null {
  if (net.isIPv4(ip) !== true) return null;
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  return parts.length === 4 && parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255)
    ? parts
    : null;
}

/** Ist die IPv4-Adresse nicht oeffentlich routbar? */
export function isBlockedIPv4(ip: string): boolean {
  const parts = ipv4ToParts(ip);
  if (!parts) return true;
  const [a, b, c, d] = parts as [number, number, number, number];

  if (a === 0) return true;                                  // 0.0.0.0/8 „this host"
  if (a === 10) return true;                                 // 10/8 privat
  if (a === 127) return true;                                // 127/8 loopback
  if (a === 169 && b === 254) return true;                   // 169.254/16 link-local (inkl. Metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;           // 172.16/12 privat
  if (a === 192 && b === 0 && c === 0) return true;            // 192.0.0/24 IETF protocol
  if (a === 192 && b === 0 && c === 2) return true;            // 192.0.2/24 TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return true;          // 6to4 relay anycast
  if (a === 192 && b === 168) return true;                    // 192.168/16 privat
  if (a === 198 && (b === 18 || b === 19)) return true;        // 198.18/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true;         // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true;          // TEST-NET-3
  if (a === 100 && b >= 64 && b <= 127) return true;           // 100.64/10 CGNAT
  if (a >= 224) return true;                                   // Multicast + reserviert + 255.x
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

/** Expandiert eine IPv6-Adresse zu 8 16-Bit-Gruppen. */
function expandIPv6(ip: string): number[] | null {
  if (net.isIPv6(ip) !== true) return null;
  let address = ip.toLowerCase();
  address = address.replace(/%.*$/, ""); // Zone-Index entfernen

  // Eingebettete IPv4-Notation (z. B. ::ffff:127.0.0.1) in Hex umschreiben.
  const v4Match = address.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Match?.[1]) {
    const v4 = ipv4ToParts(v4Match[1]);
    if (!v4) return null;
    const hi = ((v4[0] as number) << 8) | (v4[1] as number);
    const lo = ((v4[2] as number) << 8) | (v4[3] as number);
    address = address.slice(0, v4Match.index) + hi.toString(16) + ":" + lo.toString(16);
  }

  const [head, tail] = address.split("::") as [string, string | undefined];
  const headGroups = head ? head.split(":").filter(Boolean) : [];
  const tailGroups = tail ? tail.split(":").filter(Boolean) : [];
  let groups: string[];
  if (tail === undefined) {
    groups = headGroups;
  } else {
    const fill = 8 - headGroups.length - tailGroups.length;
    if (fill < 0) return null;
    groups = [...headGroups, ...Array<string>(fill).fill("0"), ...tailGroups];
  }
  if (groups.length !== 8) return null;

  const numbers = groups.map((g) => Number.parseInt(g, 16));
  return numbers.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? numbers : null;
}

/** Ist die IPv6-Adresse nicht oeffentlich routbar? */
export function isBlockedIPv6(ip: string): boolean {
  const groups = expandIPv6(stripBrackets(ip));
  if (!groups) return true;
  const [g0, g1, , , , g5, g6, g7] = groups as number[];

  const isAllZeroExceptLast = groups.slice(0, 7).every((g) => g === 0);
  if (isAllZeroExceptLast && (g7 === 0 || g7 === 1)) return true; // :: und ::1

  // IPv4-mapped/compatible: ueber die eingebettete v4-Adresse entscheiden.
  if (groups.slice(0, 5).every((g) => g === 0) && (g5 === 0xffff || g5 === 0)) {
    const embedded = `${(g6 as number) >> 8}.${(g6 as number) & 0xff}.${(g7 as number) >> 8}.${(g7 as number) & 0xff}`;
    return isBlockedIPv4(embedded);
  }

  const first = g0 as number;
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (first === 0x0100 && g1 === 0x0000) return true; // 100::/64 discard-only
  if (first === 0x2001 && (g1 as number) === 0x0db8) return true; // 2001:db8::/32 Doku
  if (first === 0x2002) return true; // 6to4 – kann private v4 kapseln
  if (first === 0x2001 && ((g1 as number) & 0xfff0) === 0x0010) return true; // ORCHID
  if (first === 0x0064 && g1 === 0xff9b) return true; // 64:ff9b::/96 NAT64

  return false;
}

/** Blockiert die Adresse, unabhaengig von der IP-Version. */
export function isBlockedIp(ip: string): boolean {
  const bare = stripBrackets(ip.trim());
  const version = net.isIP(bare);
  if (version === 4) return isBlockedIPv4(bare);
  if (version === 6) return isBlockedIPv6(bare);
  return true;
}

export type ResolvedTarget = {
  url: URL;
  hostname: string;
  addresses: string[];
};

/**
 * Vollstaendige Pruefung inklusive DNS-Aufloesung.
 * Wird fuer die Ziel-URL und fuer jeden Redirect erneut aufgerufen.
 */
export async function assertPublicUrl(
  input: string | URL,
  options: { resolver?: (hostname: string) => Promise<string[]> } = {},
): Promise<ResolvedTarget> {
  const url = input instanceof URL ? normalizeUrl(input.toString()) : normalizeUrl(input);
  const hostname = stripBrackets(url.hostname.toLowerCase());

  if (isBlockedHostname(url.hostname)) {
    throw new BlockedUrlError(
      `Die Adresse „${url.hostname}" zeigt auf ein internes Netz und wird nicht abgerufen.`,
    );
  }

  // IP-Literale brauchen kein DNS.
  if (net.isIP(hostname) !== 0) {
    if (isBlockedIp(hostname)) {
      throw new BlockedUrlError(
        `Die IP-Adresse ${hostname} liegt in einem privaten oder reservierten Bereich.`,
      );
    }
    return { url, hostname, addresses: [hostname] };
  }

  const resolve = options.resolver ?? defaultResolver;
  let addresses: string[];
  try {
    addresses = await resolve(hostname);
  } catch {
    throw new BlockedUrlError(`Der Hostname „${hostname}" konnte nicht aufgelöst werden.`);
  }

  if (addresses.length === 0) {
    throw new BlockedUrlError(`Für „${hostname}" wurde keine IP-Adresse gefunden.`);
  }

  // Strikt: sobald eine der aufgeloesten Adressen intern ist, wird abgebrochen.
  const blocked = addresses.find((address) => isBlockedIp(address));
  if (blocked) {
    throw new BlockedUrlError(
      `„${hostname}" löst auf die interne Adresse ${blocked} auf und wird nicht abgerufen.`,
    );
  }

  return { url, hostname, addresses };
}

async function defaultResolver(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}
