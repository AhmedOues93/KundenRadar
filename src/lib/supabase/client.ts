"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";

/** Supabase-Client für Client-Komponenten. Nutzt ausschliesslich den anon key. */
export function createClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
