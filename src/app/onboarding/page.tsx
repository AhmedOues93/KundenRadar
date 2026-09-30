import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { OrganizationForm } from "@/components/organization-form";
import { Card, CardBody } from "@/components/ui";
import { ConfigNotice } from "@/components/config-notice";

export const metadata: Metadata = { title: "Organisation anlegen" };
export const dynamic = "force-dynamic";

/**
 * Erster Schritt nach der Registrierung: eine Organisation anlegen. Alle
 * fachlichen Daten haengen an ihr, damit das Modell von Anfang an
 * mandantenfaehig ist.
 */
export default async function OnboardingPage() {
  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen">
        <ConfigNotice />
      </main>
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const existing = await getSessionContext();
  if (existing) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-lg font-semibold tracking-tight text-slate-900">
          Organisation anlegen
        </h1>
        <p className="mb-5 text-sm text-slate-500">
          Alle Leads, Analysen und Notizen gehören zu genau einer Organisation. Du wirst
          automatisch deren Inhaber.
        </p>
        <Card>
          <CardBody>
            <OrganizationForm />
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
