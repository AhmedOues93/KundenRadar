import { requireSessionContext } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { ORGANIZATION_ROLE_LABELS } from "@/lib/constants";
import { AppNav } from "@/components/app-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { ConfigNotice } from "@/components/config-notice";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Geschützte Hülle für alle internen Seiten. Ohne gültige Session bricht
 * `requireSessionContext` mit einer Umleitung auf `/login` ab – Kundendaten
 * werden also nie gerendert.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen">
        <ConfigNotice />
      </div>
    );
  }

  const session = await requireSessionContext();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="lg:flex lg:min-h-screen lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
        <div className="hidden px-4 pt-5 lg:block">
          <p className="text-sm font-semibold tracking-tight text-slate-900">KundenRadar</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{session.organizationName}</p>
        </div>

        <div className="lg:px-3">
          <AppNav organizationName={session.organizationName} />
        </div>

        <div className="mt-auto hidden border-t border-slate-200 px-4 py-3 lg:block">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600"
            >
              {initials(session.fullName ?? session.email)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-700">
                {session.fullName ?? session.email ?? "Nutzer"}
              </p>
              <p className="text-[11px] text-slate-400">
                {ORGANIZATION_ROLE_LABELS[session.role]}
              </p>
            </div>
          </div>
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">{children}</div>
        <div className="mx-auto mt-8 max-w-7xl border-t border-slate-200 pt-3 lg:hidden">
          <SignOutButton />
        </div>
      </main>
    </div>
  );
}
