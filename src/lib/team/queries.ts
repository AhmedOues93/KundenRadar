import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type { OrganizationRole } from "@/lib/types";
import { invitationStatus, type Invitation, type Member } from "./types";

export async function loadMembers(
  organizationId: string,
  currentUserId: string,
): Promise<Member[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, user_id, role, created_at, profiles(email, full_name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Mitglieder konnten nicht geladen werden: ${error.message}`);

  return (data ?? []).map((row) => {
    const raw = row as {
      id: string;
      user_id: string;
      role: OrganizationRole;
      created_at: string;
      profiles: { email: string | null; full_name: string | null }[] | { email: string | null; full_name: string | null } | null;
    };
    const profile = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles;
    return {
      id: raw.id,
      userId: raw.user_id,
      role: raw.role,
      email: profile?.email ?? null,
      fullName: profile?.full_name ?? null,
      joinedAt: raw.created_at,
      isSelf: raw.user_id === currentUserId,
    };
  });
}

/** Einladungen. Nur Administratoren erhalten über RLS überhaupt Zeilen. */
export async function loadInvitations(organizationId: string): Promise<Invitation[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("organization_invitations")
    .select("id, email, role, expires_at, created_at, accepted_at, revoked_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return [];

  return (data ?? []).map((row) => {
    const raw = row as {
      id: string;
      email: string;
      role: OrganizationRole;
      expires_at: string;
      created_at: string;
      accepted_at: string | null;
      revoked_at: string | null;
    };
    return {
      id: raw.id,
      email: raw.email,
      role: raw.role,
      status: invitationStatus(raw),
      expiresAt: raw.expires_at,
      createdAt: raw.created_at,
      acceptedAt: raw.accepted_at,
      revokedAt: raw.revoked_at,
    };
  });
}
