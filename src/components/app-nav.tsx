"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Navigation in Gruppen – Akquise-Ablauf oben, Auswertung darunter. */
export const NAV_GROUPS = [
  {
    label: "Akquise",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/leads/discover", label: "Lead-Suche" },
      { href: "/leads", label: "Leads" },
      { href: "/pipeline", label: "Pipeline" },
    ],
  },
  {
    label: "Analyse",
    items: [
      { href: "/qualifizierung", label: "Qualifizierung" },
      { href: "/analysen", label: "Analysen" },
    ],
  },
  {
    label: "Verwaltung",
    items: [{ href: "/einstellungen", label: "Einstellungen" }],
  },
] as const;

const ALL_HREFS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

/** Laengster passender Pfad gewinnt, damit /leads/discover nicht /leads markiert. */
function activeHref(pathname: string): string | undefined {
  return ALL_HREFS.filter(
    (candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`),
  ).sort((a, b) => b.length - a.length)[0];
}

export function AppNav({ organizationName }: { organizationName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = activeHref(pathname);

  return (
    <>
      {/* Kopfzeile nur auf kleinen Bildschirmen */}
      <div className="flex items-center justify-between border-b border-[var(--kr-line)] bg-white px-3 py-2 lg:hidden">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900">KundenRadar</p>
          <p className="truncate text-[11px] text-slate-500">{organizationName}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="hauptnavigation"
          className="rounded border border-[var(--kr-line-strong)] px-2 py-1 text-[11px] font-medium text-slate-700"
        >
          {open ? "Schliessen" : "Menü"}
        </button>
      </div>

      <nav
        id="hauptnavigation"
        aria-label="Hauptnavigation"
        className={cn(
          "border-b border-[var(--kr-line)] bg-white px-2 py-2 lg:block lg:border-b-0 lg:px-2 lg:py-0",
          open ? "block" : "hidden",
        )}
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-2.5 last:mb-0">
            <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {group.label}
            </p>
            <ul className="space-y-px">
              {group.items.map((item) => {
                const isActive = active === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center rounded px-2 py-1 text-[13px] transition-colors",
                        isActive
                          ? "bg-slate-900 font-medium text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
