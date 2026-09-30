import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, serviceRoleKey } from "@/lib/env";

/**
 * Client mit Service-Role-Rechten. Umgeht RLS und darf deshalb ausschliesslich
 * serverseitig und nur für klar begrenzte administrative Aufgaben verwendet
 * werden. `server-only` stellt sicher, dass der Import im Browser fehlschlägt.
 */
export function createAdminClient() {
  const key = serviceRoleKey();
  if (!SUPABASE_URL || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ist nicht konfiguriert.");
  }
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
