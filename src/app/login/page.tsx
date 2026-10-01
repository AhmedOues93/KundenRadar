import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/env";
import { SignInForm, SignUpForm } from "@/components/auth-form";
import { Card, CardBody } from "@/components/ui";

export const metadata: Metadata = { title: "Anmelden" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; registrieren?: string }>;
}) {
  const params = await searchParams;
  const showSignUp = params.registrieren === "1";

  if (!isSupabaseConfigured) redirect("/setup");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-lg font-semibold tracking-tight text-slate-900">{APP_NAME}</p>
          <p className="mt-1 text-sm text-slate-500">
            Akquise-Radar für Webagenturen. Interner Zugang.
          </p>
        </div>

        <Card>
          <CardBody>
            {showSignUp ? <SignUpForm /> : <SignInForm redirectTo={params.redirectTo} />}
          </CardBody>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-500">
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
