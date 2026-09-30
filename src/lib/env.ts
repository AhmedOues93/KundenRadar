/**
 * Zugriff auf Umgebungsvariablen an einer Stelle.
 *
 * Die App muss sich auch ohne Supabase-Zugangsdaten bauen und starten lassen.
 * Fehlt die Konfiguration, zeigen die Seiten einen Hinweis statt abzustürzen.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Nur serverseitig lesen – dieser Wert darf niemals in den Browser gelangen. */
export function serviceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const MISSING_CONFIG_MESSAGE =
  "Supabase ist nicht konfiguriert. Hinterlege NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.";
