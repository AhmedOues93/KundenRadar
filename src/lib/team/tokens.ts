import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Einladungstoken.
 *
 * Gespeichert wird ausschliesslich der SHA-256-Hash – wer die Datenbank liest,
 * kann daraus keinen gültigen Link bauen. Die Hash-Bildung entspricht exakt
 * `encode(digest(token, 'sha256'), 'hex')` in der Migration.
 */

/** 32 Zufallsbytes, URL-sicher kodiert (43 Zeichen). */
export function createInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Tokens haben ein festes Format; alles andere wird gar nicht erst geprüft. */
export function isPlausibleToken(token: string): boolean {
  return typeof token === "string" && /^[A-Za-z0-9_-]{32,64}$/.test(token);
}

/** Vergleich ohne Laufzeitunterschiede, falls einmal direkt verglichen wird. */
export function tokenHashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Gültigkeitsdauer einer Einladung. */
export const INVITATION_TTL_DAYS = 14;

export function invitationExpiry(now = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}
