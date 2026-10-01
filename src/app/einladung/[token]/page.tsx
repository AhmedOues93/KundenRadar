import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { isPlausibleToken } from "@/lib/team/tokens";
import { ORGANIZATION_ROLE_LABELS } from "@/lib/constants";
import { INVITATION_STATUS_LABELS, type InvitationPreview } from "@/lib/team/types";
import { AcceptInvitationForm } from "@/components/accept-invitation";
import { Alert, Panel, PanelBody, buttonClasses } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Einladung" };
export const dynamic = "force-dynamic";

/**
 * Annahmeseite einer Einladung. Die Vorschau kommt aus einer SECURITY-DEFINER-
 * Funktion, weil die eingeladene Person noch kein Mitglied ist und die Tabelle
 * deshalb nicht lesen darf.
 */
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/setup");

  const { token } = await params;
  if (!isPlausibleToken(token)) return <Shell>{<Alert tone="error">Dieser Einladungslink ist ungültig.</Alert>}</Shell>;

  const supabase = await createServerSupabase();
  const [{ data: previewRows }, { data: userData }] = await Promise.all([
    supabase.rpc("invitation_preview", { invite_token: token }),
    supabase.auth.getUser(),
  ]);

  const raw = Array.isArray(previewRows) ? previewRows[0] : null;
  if (!raw) {
    return (
      <Shell>
        <Alert tone="error" title="Einladung nicht gefunden">
          Der Link ist ungültig oder wurde bereits entfernt.
        </Alert>
      </Shell>
    );
  }

  const preview: InvitationPreview = {
    organizationName: raw.organization_name,
    email: raw.email,
    role: raw.role,
    expiresAt: raw.expires_at,
    status: raw.status,
  };

  const user = userData.user;
  const emailPasst = user?.email?.toLowerCase() === preview.email.toLowerCase();

  return (
    <Shell>
      <Panel>
        <PanelBody className="space-y-2.5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.06em] text-slate-500">Einladung</p>
            <p className="mt-0.5 text-[17px] font-semibold text-slate-900">
              {preview.organizationName}
            </p>
            <p className="mt-0.5 text-[12.5px] text-slate-600">
              Für <span className="font-medium">{preview.email}</span> als{" "}
              {ORGANIZATION_ROLE_LABELS[preview.role]} · gültig bis{" "}
              {formatDate(preview.expiresAt)}
            </p>
          </div>

          {preview.status !== "PENDING" ? (
            <Alert tone="warning" title={INVITATION_STATUS_LABELS[preview.status]}>
              {preview.status === "ACCEPTED"
                ? "Diese Einladung wurde bereits angenommen."
                : preview.status === "REVOKED"
                  ? "Diese Einladung wurde zurückgezogen."
                  : "Diese Einladung ist abgelaufen. Bitte eine neue anfordern."}
            </Alert>
          ) : !user ? (
            <>
              <Alert tone="info">
                Melde dich mit {preview.email} an oder lege ein Konto mit genau dieser Adresse an,
                um die Einladung anzunehmen.
              </Alert>
              <div className="flex flex-wrap gap-1.5">
                <Link
                  href={`/login?redirectTo=${encodeURIComponent(`/einladung/${token}`)}`}
                  className={buttonClasses("primary")}
                >
                  Anmelden
                </Link>
                <Link href="/login?registrieren=1" className={buttonClasses("secondary")}>
                  Konto anlegen
                </Link>
              </div>
            </>
          ) : !emailPasst ? (
            <Alert tone="error" title="Anderes Konto angemeldet">
              Die Einladung gilt für {preview.email}, angemeldet ist {user.email}. Melde dich ab und
              mit der eingeladenen Adresse wieder an.
            </Alert>
          ) : (
            <AcceptInvitationForm token={token} organizationName={preview.organizationName} />
          )}
        </PanelBody>
      </Panel>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <p className="mb-3 text-center text-[13px] font-semibold text-slate-900">KundenRadar</p>
        {children}
      </div>
    </main>
  );
}
