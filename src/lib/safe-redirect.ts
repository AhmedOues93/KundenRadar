/**
 * Prüfung von Weiterleitungszielen aus Benutzereingaben.
 *
 * Nach dem Login wird auf `?redirectTo=` weitergeleitet. Eine Prüfung auf
 * Präfixe allein genügt dafür nicht: Browser normalisieren den Backslash in
 * URLs zu einem Schrägstrich, weshalb `/\evil.com` als `//evil.com` gelesen
 * wird – also als protokollrelative Adresse auf eine fremde Domain.
 *
 * Deshalb wird das Ziel gegen einen festen Ursprung aufgelöst und verworfen,
 * sobald es dabei woanders landet.
 */

/** Nur zum Vergleich; dieser Ursprung wird nie aufgerufen. */
const REFERENCE_ORIGIN = "https://kundenradar.invalid";

export function isSafeRedirect(target: string): boolean {
  if (typeof target !== "string" || target.length === 0) return false;
  if (target.length > 1024) return false;
  if (!target.startsWith("/")) return false;

  // Steuerzeichen können Prüfungen unterlaufen und in Header gelangen.
  if (/[\u0000-\u001f\u007f]/.test(target)) return false;

  let url: URL;
  try {
    url = new URL(target, REFERENCE_ORIGIN);
  } catch {
    return false;
  }

  return url.origin === REFERENCE_ORIGIN;
}

/** Sicheres Ziel oder die Vorgabe. */
export function safeRedirectTarget(target: string | null | undefined, fallback = "/dashboard"): string {
  return target && isSafeRedirect(target) ? target : fallback;
}
