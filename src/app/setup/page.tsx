import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { ConfigNotice } from "@/components/config-notice";

export const metadata: Metadata = { title: "Einrichtung" };
export const dynamic = "force-dynamic";

/**
 * Öffentliche Seite für den Fall, dass noch keine Supabase-Zugangsdaten
 * hinterlegt sind. Die geschützten Seiten leiten hierher um, statt beim
 * Datenbankzugriff eine Ausnahme zu werfen.
 */
export default function SetupPage() {
  if (isSupabaseConfigured) redirect("/dashboard");

  return (
    <main className="min-h-screen">
      <ConfigNotice />
    </main>
  );
}
