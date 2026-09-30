"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/analysen", label: "Analysen" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/einstellungen", label: "Einstellungen" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Seitliche Navigation auf Desktop, ausklappbares Menü auf Mobile. */
export function AppNav({ organizationName }: { organizationName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile Kopfzeile */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">KundenRadar</p>
          <p className="truncate text-xs text-slate-500">{organizationName}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="hauptnavigation"
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700"
        >
          {open ? "Schliessen" : "Menü"}
        </button>
      </div>

      <nav
        id="hauptnavigation"
        aria-label="Hauptnavigation"
        className={cn(
          "border-b border-slate-200 bg-white px-3 py-2 lg:block lg:border-b-0 lg:px-0 lg:py-0",
          open ? "block" : "hidden",
        )}
      >
        <p className="hidden px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:block">
          Navigation
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive(pathname, item.href)
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
