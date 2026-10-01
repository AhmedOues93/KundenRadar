import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionContext } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { ORGANIZATION_ROLE_LABELS } from "@/lib/constants";
import { AppNav } from "@/components/app-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Geschützte Hülle. Ohne gültige Session bricht `requireSessionContext` mit
 * einer Umleitung ab – Kundendaten werden also nie gerendert.
 *
 * Layout: feste Seitenspalte, Inhalt nutzt die volle Breite bis 1680px. Die
 * Anwendung wird überwiegend am Desktop bedient.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) redirect("/setup");

  const session = await requireSessionContext();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[13.5rem_1fr]">
      <aside className="lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-[var(--kr-line)] lg:bg-white">
        <div className="hidden px-3 pb-2 pt-3 lg:block">
          <Link href="/dashboard" className="block">
            <p className="text-[13px] font-semibold tracking-[-0.01em] text-slate-900">
              KundenRadar
            </p>
            <p className="mt-px truncate text-[11px] text-slate-500">{session.organizationName}</p>
          </Link>
        </div>

        <div className="lg:flex-1 lg:overflow-y-auto">
          <AppNav organizationName={session.organizationName} />
        </div>

        <div className="hidden border-t border-[var(--kr-line)] px-3 py-2 lg:block">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600"
            >
              {initials(session.fullName ?? session.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-slate-700">
                {session.fullName ?? session.email ?? "Nutzer"}
              </p>
              <p className="text-[10.5px] text-slate-400">
                {ORGANIZATION_ROLE_LABELS[session.role]}
              </p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-3 py-3 sm:px-5 lg:px-6 lg:py-5">
        <div className="mx-auto max-w-[1680px]">{children}</div>
        <div className="mx-auto mt-6 max-w-[1680px] border-t border-[var(--kr-line)] pt-2 lg:hidden">
          <SignOutButton />
        </div>
      </main>
    </div>
  );
}
