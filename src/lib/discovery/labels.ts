import type { MatchStatus } from "./types";

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  NEW: "Neu",
  DUPLICATE_DOMAIN: "Domain bereits erfasst",
  DUPLICATE_NAME_ADDRESS: "Name und Adresse bereits erfasst",
  DUPLICATE_IN_RESULT: "Mehrfach im Ergebnis",
};

export const MATCH_STATUS_TONE: Record<MatchStatus, string> = {
  NEW: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DUPLICATE_DOMAIN: "bg-slate-100 text-slate-600 ring-slate-200",
  DUPLICATE_NAME_ADDRESS: "bg-slate-100 text-slate-600 ring-slate-200",
  DUPLICATE_IN_RESULT: "bg-slate-50 text-slate-500 ring-slate-200",
};

export const DISCOVERY_RUN_STATUS_LABELS = {
  PENDING: "Läuft",
  SUCCESS: "Abgeschlossen",
  FAILED: "Fehlgeschlagen",
} as const;

export const DISCOVERY_PROVIDER_LABELS: Record<string, string> = {
  OSM_OVERPASS: "OpenStreetMap",
};

export function providerLabel(provider: string): string {
  return DISCOVERY_PROVIDER_LABELS[provider] ?? provider;
}
