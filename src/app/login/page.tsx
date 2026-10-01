import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/env";
import { SignInForm, SignUpForm } from "@/components/auth-form";
import { Panel, PanelBody } from "@/components/ui";

export const metadata: Metadata = { title: "Anmelden" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; registrieren?: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/setup");

  const params = await searchParams;
  const showSignUp = params.registrieren === "1";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-4 text-center">
          <p className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">{APP_NAME}</p>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Akquise-Radar für Webagenturen · interner Zugang
          </p>
        </div>

        <Panel>
          <PanelBody>
            {showSignUp ? <SignUpForm /> : <SignInForm redirectTo={params.redirectTo} />}
          </PanelBody>
        </Panel>

        <p className="mt-3 text-center text-[12px] text-slate-500">
          {showSignUp ? (
            <Link href="/login" className="font-medium text-slate-700 underline">
              Zurück zur Anmeldung
            </Link>
          ) : (
            <Link href="/login?registrieren=1" className="font-medium text-slate-700 underline">
              Neues Konto anlegen
            </Link>
          )}
        </p>
      </div>
    </main>
  );
}
