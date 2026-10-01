import type { OrganizationRole } from "@/lib/types";

export const INVITATION_STATUSES = ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export type Member = {
  id: string;
  userId: string;
  role: OrganizationRole;
  email: string | null;
  fullName: string | null;
  joinedAt: string;
  /** True für die eigene Mitgliedschaft. */
  isSelf: boolean;
};

export type Invitation = {
  id: string;
  email: string;
  role: OrganizationRole;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

export type InvitationPreview = {
  organizationName: string;
  email: string;
  role: OrganizationRole;
  expiresAt: string;
  status: InvitationStatus;
};

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: "Offen",
  ACCEPTED: "Angenommen",
  REVOKED: "Zurückgezogen",
  EXPIRED: "Abgelaufen",
};

export const INVITATION_STATUS_TONE: Record<InvitationStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REVOKED: "bg-slate-100 text-slate-600 ring-slate-200",
  EXPIRED: "bg-slate-100 text-slate-500 ring-slate-200",
};

/** Leitet den Status ab, wenn die Datenbank nur Zeitstempel liefert. */
export function invitationStatus(row: {
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}): InvitationStatus {
  if (row.revoked_at) return "REVOKED";
  if (row.accepted_at) return "ACCEPTED";
  if (new Date(row.expires_at).getTime() < Date.now()) return "EXPIRED";
  return "PENDING";
}
