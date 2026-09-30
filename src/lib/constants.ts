import type {
  FindingGroup,
  FindingSeverity,
  LeadSource,
  LeadStatus,
  OrganizationRole,
} from "./types";

export const APP_NAME = "KundenRadar";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Neu",
  ANALYZED: "Analysiert",
  REVIEW: "Prüfen",
  TO_CONTACT: "Kontaktieren",
  CONTACTED: "Kontaktiert",
  REPLIED: "Antwort erhalten",
  MEETING: "Termin",
  OFFER: "Angebot",
  WON: "Gewonnen",
  LOST: "Verloren",
  ARCHIVED: "Archiviert",
};

/** Tailwind-Klassen je Status, damit Badges konsistent aussehen. */
export const LEAD_STATUS_TONE: Record<LeadStatus, string> = {
  NEW: "bg-slate-100 text-slate-700 ring-slate-200",
  ANALYZED: "bg-sky-50 text-sky-700 ring-sky-200",
  REVIEW: "bg-violet-50 text-violet-700 ring-violet-200",
  TO_CONTACT: "bg-amber-50 text-amber-800 ring-amber-200",
  CONTACTED: "bg-blue-50 text-blue-700 ring-blue-200",
  REPLIED: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  MEETING: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  OFFER: "bg-orange-50 text-orange-800 ring-orange-200",
  WON: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  LOST: "bg-rose-50 text-rose-700 ring-rose-200",
  ARCHIVED: "bg-slate-50 text-slate-500 ring-slate-200",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  MANUAL: "Manuell erfasst",
  IMPORT: "Import",
  REFERRAL: "Empfehlung",
  INBOUND: "Inbound-Anfrage",
  RESEARCH: "Recherche",
  OTHER: "Sonstiges",
};

export const ORGANIZATION_ROLE_LABELS: Record<OrganizationRole, string> = {
  OWNER: "Inhaber",
  ADMIN: "Administrator",
  MEMBER: "Mitglied",
};

/**
 * Spalten der Akquise-Pipeline. `LOST` und `ARCHIVED` bleiben bewusst aussen
 * vor. `absorbs` nennt weitere Status, die in derselben Spalte erscheinen –
 * so fällt ein frisch analysierter Lead nicht aus der Pipeline heraus.
 */
export const PIPELINE_COLUMNS: {
  status: LeadStatus;
  label: string;
  absorbs?: LeadStatus[];
}[] = [
  { status: "NEW", label: "Neu" },
  { status: "REVIEW", label: "Prüfen", absorbs: ["ANALYZED"] },
  { status: "TO_CONTACT", label: "Kontaktieren" },
  { status: "CONTACTED", label: "Kontaktiert" },
  { status: "REPLIED", label: "Antwort" },
  { status: "MEETING", label: "Termin" },
  { status: "OFFER", label: "Angebot" },
  { status: "WON", label: "Gewonnen" },
];

/** Alle Status, die in der Pipeline dargestellt werden. */
export const PIPELINE_STATUSES: LeadStatus[] = PIPELINE_COLUMNS.flatMap((column) => [
  column.status,
  ...(column.absorbs ?? []),
]);

export const FINDING_GROUP_LABELS: Record<FindingGroup, string> = {
  TECHNIK: "Technik",
  SEO: "SEO-Grundlagen",
  MOBILE: "Mobile-Grundlagen",
  ACCESSIBILITY: "Barrierefreiheit-Grundlagen",
  CONTENT: "Content & Struktur",
  AGENCY: "Agenturhinweise",
};

export const FINDING_GROUP_ORDER: FindingGroup[] = [
  "TECHNIK",
  "SEO",
  "MOBILE",
  "ACCESSIBILITY",
  "CONTENT",
  "AGENCY",
];

export const FINDING_SEVERITY_LABELS: Record<FindingSeverity, string> = {
  PROBLEM: "Problem",
  HINWEIS: "Hinweis",
  OK: "In Ordnung",
  INFO: "Information",
};

export const FINDING_SEVERITY_TONE: Record<FindingSeverity, string> = {
  PROBLEM: "bg-rose-50 text-rose-700 ring-rose-200",
  HINWEIS: "bg-amber-50 text-amber-800 ring-amber-200",
  OK: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  INFO: "bg-slate-100 text-slate-600 ring-slate-200",
};

/**
 * Bewertungsbänder. Der Score beschreibt ausschliesslich, wie interessant
 * eine Website für eine manuelle Akquise-Prüfung erscheint – nicht, ob die
 * Firma Kunde wird.
 */
export const SCORE_BANDS = [
  { min: 0, max: 29, label: "Geringes technisches Potenzial", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
  { min: 30, max: 59, label: "Prüfen", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
  { min: 60, max: 79, label: "Interessant", tone: "bg-orange-50 text-orange-800 ring-orange-200" },
  { min: 80, max: 100, label: "Hohes Analysepotenzial", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
] as const;

export function scoreBand(score: number | null | undefined) {
  if (score === null || score === undefined) return null;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return SCORE_BANDS.find((band) => clamped >= band.min && clamped <= band.max) ?? SCORE_BANDS[0];
}

export const ANALYSIS_STATUS_LABELS = {
  PENDING: "Läuft",
  SUCCESS: "Erfolgreich",
  FAILED: "Fehlgeschlagen",
  BLOCKED: "Blockiert",
} as const;
