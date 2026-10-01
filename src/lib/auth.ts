import "server-only";

import { redirect } from "next/navigation";
import type { OrganizationRole } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export type SessionContext = {
  userId: string;
  email: string | null;
  fullName: string | null;
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
};

/**
 * Laedt Nutzer und aktive Organisation. Leitet auf `/login` um, wenn keine
 * Session besteht, und auf `/onboarding`, wenn noch keine Organisation
 * existiert. Jede geschützte Seite ruft diese Funktion auf.
 */
export async function requireSessionContext(): Promise<SessionContext> {
  // Layout und Seite rendern in Next parallel: ohne diese Prüfung würde die
  // Seite trotz Einrichtungshinweis im Layout eine Ausnahme werfen.
  if (!isSupabaseConfigured) redirect("/setup");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name, slug, created_at)")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw new Error(`Organisation konnte nicht geladen werden: ${error.message}`);

  const membership = memberships?.[0];
  if (!membership) redirect("/onboarding");

  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
    organizationId: membership.organization_id as string,
    organizationName: (organization?.name as string | undefined) ?? "Organisation",
    role: membership.role as OrganizationRole,
  };
}

/** Wie `requireSessionContext`, wirft aber nicht und leitet nicht um. */
export async function getSessionContext(): Promise<SessionContext | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name, slug, created_at)")
    .order("created_at", { ascending: true })
    .limit(1);

  const membership = memberships?.[0];
  if (!membership) return null;

  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
    organizationId: membership.organization_id as string,
    organizationName: (organization?.name as string | undefined) ?? "Organisation",
    role: membership.role as OrganizationRole,
  };
}

export function hasAdminRights(role: OrganizationRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}
