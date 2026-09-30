import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";

/**
 * Supabase-Client für Server-Komponenten, Route Handler und Server Actions.
 * Die Session steckt in httpOnly-Cookies; RLS bleibt aktiv.
 */
export async function createServerSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // In Server-Komponenten sind Cookie-Writes nicht erlaubt.
          // Die Middleware übernimmt das Auffrischen der Session.
        }
      },
    },
  });
}
