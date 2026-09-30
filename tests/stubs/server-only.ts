/**
 * Ersatz für das `server-only`-Modul von Next.js.
 *
 * Next liefert dieses Modul nur im eigenen Build auf; für Vitest wird es über
 * `vitest.config.ts` hierauf umgebogen. Der Schutz im Produktionsbuild bleibt
 * dadurch unverändert – Server-Module lassen sich weiterhin nicht im Browser
 * importieren.
 */
export {};
