import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* ==========================================================================
   Oberflaechenbausteine
   --------------------------------------------------------------------------
   Ausgelegt auf Desktop-Arbeit: schmale Rahmen, kompakte Hoehen, hohe
   Informationsdichte. Keine grossflaechigen Karten, keine weiten Abstaende.
   ========================================================================== */

/* -------------------------------------------------------------------------- */
/* Panel – der Standardcontainer                                              */
/* -------------------------------------------------------------------------- */

export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-md border border-[var(--kr-line)] bg-white", className)}
      {...props}
    />
  );
}

export function PanelHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--kr-line)] px-3 py-1.5",
        className,
      )}
      {...props}
    />
  );
}

export function PanelTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500",
        className,
      )}
      {...props}
    />
  );
}

export function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-3 py-2.5", className)} {...props} />;
}

/** Rueckwaertskompatible Namen – weiterhin als Panel gerendert. */
export const Card = Panel;
export const CardHeader = PanelHeader;
export const CardTitle = PanelTitle;
export const CardBody = PanelBody;

/* -------------------------------------------------------------------------- */
/* Badge                                                                      */
/* -------------------------------------------------------------------------- */

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & { tone?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded px-1.5 py-px text-[11px] font-medium ring-1 ring-inset",
        tone ?? "bg-slate-100 text-slate-700 ring-slate-200",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "xs" | "sm" | "md";

const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-slate-900 bg-slate-900 text-white hover:border-slate-700 hover:bg-slate-700",
  secondary: "border-[var(--kr-line-strong)] bg-white text-slate-700 hover:bg-slate-50",
  ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  xs: "h-6 px-1.5 text-[11px]",
  sm: "h-7 px-2 text-xs",
  md: "h-8 px-2.5 text-[13px]",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size]);
}

export const Button = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ className, variant = "primary", size = "md", ...props }, ref) {
  return <button ref={ref} className={cn(buttonClasses(variant, size), className)} {...props} />;
});

export function LinkButton({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={cn(buttonClasses(variant, size), className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Formularelemente                                                           */
/* -------------------------------------------------------------------------- */

const FIELD_BASE =
  "w-full rounded border border-[var(--kr-line-strong)] bg-white px-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-blue-600 disabled:bg-slate-50 disabled:text-slate-500";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(FIELD_BASE, "h-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(FIELD_BASE, "min-h-16 py-1.5", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(FIELD_BASE, "h-8 pr-7", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-0.5 block text-[11px] font-medium text-slate-500", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="mt-0.5 text-[11px] text-rose-700">{error}</p>
      ) : hint ? (
        <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabelle                                                                    */
/* -------------------------------------------------------------------------- */

/** Scrollbereich mit festem Kopf – fuer lange Listen auf grossen Bildschirmen. */
export function TableWrap({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("kr-scroll overflow-x-auto", className)} {...props} />;
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-[13px]", className)} {...props} />;
}

export function Thead({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn(
        "sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500",
        className,
      )}
      {...props}
    />
  );
}

export function Th({
  className,
  align = "left",
  ...props
}: React.ComponentProps<"th"> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-[var(--kr-line)] px-2.5 py-1.5 font-semibold",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-b border-[var(--kr-line)] last:border-b-0 hover:bg-slate-50", className)}
      {...props}
    />
  );
}

export function Td({
  className,
  align = "left",
  ...props
}: React.ComponentProps<"td"> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "px-2.5 py-1.5 align-middle",
        align === "right" && "text-right tabnum",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

/** Spaltenkopf, der die Sortierung ueber die URL umschaltet. */
export function SortableTh({
  label,
  sortKey,
  current,
  hrefFor,
  align = "left",
  className,
}: {
  label: string;
  sortKey: string;
  current: string;
  hrefFor: (key: string) => string;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const active = current === sortKey;
  return (
    <Th align={align} className={className} aria-sort={active ? "descending" : "none"}>
      <Link
        href={hrefFor(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-slate-900",
          active && "text-slate-900",
        )}
      >
        {label}
        <span aria-hidden className={cn("text-[9px]", active ? "opacity-100" : "opacity-25")}>
          ▼
        </span>
      </Link>
    </Th>
  );
}

/* -------------------------------------------------------------------------- */
/* Kennzahlenleiste                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Kennzahlen als zusammenhaengende Leiste statt als Einzelkarten: ein Rahmen,
 * Haarlinien dazwischen. Das spart vertikalen Platz und liest sich schneller.
 */
export function StatStrip({ className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl
      className={cn(
        "grid divide-x divide-y divide-[var(--kr-line)] overflow-hidden rounded-md border border-[var(--kr-line)] bg-white",
        className,
      )}
      {...props}
    />
  );
}

export function Stat({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  tone?: string;
}) {
  const inner = (
    <>
      <dt className="truncate text-[11px] text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 text-[19px] font-semibold leading-none tabnum", tone ?? "text-slate-900")}>
        {value}
      </dd>
      {hint ? <p className="mt-0.5 truncate text-[10.5px] text-slate-400">{hint}</p> : null}
    </>
  );

  const base = "block px-3 py-2";
  if (href) {
    return (
      <Link href={href} className={cn(base, "transition-colors hover:bg-slate-50")}>
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}

/* -------------------------------------------------------------------------- */
/* Hinweise, Leerzustaende, Seitenkopf                                        */
/* -------------------------------------------------------------------------- */

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-blue-200 bg-blue-50/70 text-blue-900",
    warning: "border-amber-200 bg-amber-50/70 text-amber-900",
    error: "border-rose-200 bg-rose-50/70 text-rose-900",
    success: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
  } as const;

  return (
    <div className={cn("rounded border px-2.5 py-1.5 text-[12.5px]", tones[tone], className)} role="status">
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title && "mt-0.5")}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  compact = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 text-center",
        compact ? "px-3 py-5" : "px-3 py-10",
      )}
    >
      <p className="text-[13px] font-medium text-slate-700">{title}</p>
      {description ? <p className="max-w-md text-xs text-slate-500">{description}</p> : null}
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
  className,
}: {
  title: string;
  description?: string;
  /** Kurze Kennzahlen direkt neben dem Titel, z. B. „124 Leads". */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-slate-900">{title}</h1>
          {meta ? <span className="text-xs text-slate-500">{meta}</span> : null}
        </div>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-1.5">{actions}</div> : null}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Beschreibungsliste fuer Detailansichten                                    */
/* -------------------------------------------------------------------------- */

export function DescriptionList({ className, ...props }: React.ComponentProps<"dl">) {
  return <dl className={cn("divide-y divide-[var(--kr-line)]", className)} {...props} />;
}

export function DescriptionRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-3 px-3 py-1.5", className)}>
      <dt className="w-32 shrink-0 text-[11.5px] text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-[13px] text-slate-800">{children}</dd>
    </div>
  );
}

/** Platzhalter fuer fehlende Werte – einheitlich statt mal „–", mal leer. */
export function Blank() {
  return <span className="text-slate-300">–</span>;
}

/* -------------------------------------------------------------------------- */
/* Werkzeugleiste ueber Tabellen                                              */
/* -------------------------------------------------------------------------- */

export function Toolbar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-x-2 gap-y-1.5 border-b border-[var(--kr-line)] px-3 py-2",
        className,
      )}
      {...props}
    />
  );
}

/** Schmales Feld in der Werkzeugleiste. */
export function ToolbarField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
