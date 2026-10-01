"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasAdminRights, requireSessionContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { ORGANIZATION_ROLES, type OrganizationRole } from "@/lib/types";
import {
  createInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  isPlausibleToken,
} from "@/lib/team/tokens";
import { type ActionState, failed, fieldErrors, text } from "./shared";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail angeben.").max(200),
  role: z.enum(ORGANIZATION_ROLES),
});

/**
 * Legt eine Einladung an und gibt den Link **einmalig** zurück.
 *
 * Es wird bewusst keine E-Mail verschickt: dafür ist kein Versanddienst
 * eingerichtet, und eine erfundene Erfolgsmeldung wäre irreführend. Der Link
 * wird angezeigt und von der einladenden Person selbst weitergegeben.
 */
export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSessionContext();
  if (!hasAdminRights(session.role)) {
    return failed("Nur Inhaber und Administratoren können Mitglieder einladen.");
  }

  const parsed = inviteSchema.safeParse({
    email: text(formData.get("email")),
    role: text(formData.get("role")) || "MEMBER",
  });
  if (!parsed.success) return failed("Bitte Eingaben prüfen.", fieldErrors(parsed.error));

  const supabase = await createServerSupabase();

  // Wer schon Mitglied ist, braucht keine Einladung.
  const { data: vorhanden } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (vorhanden) {
    const { data: mitglied } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", session.organizationId)
      .eq("user_id", vorhanden.id)
      .maybeSingle();
    if (mitglied) {
      return failed(`${parsed.data.email} gehört bereits zu dieser Organisation.`, {
        email: "Bereits Mitglied.",
      });
    }
  }

  const token = createInvitationToken();
  const { error } = await supabase.from("organization_invitations").insert({
    organization_id: session.organizationId,
    email: parsed.data.email,
    role: parsed.data.role,
    token_hash: hashInvitationToken(token),
    expires_at: invitationExpiry().toISOString(),
    invited_by: session.userId,
  });

  if (error) {
    if (error.code === "23505") {
      return failed(`Für ${parsed.data.email} ist bereits eine Einladung offen.`, {
        email: "Einladung bereits offen.",
      });
    }
    return failed(`Die Einladung konnte nicht angelegt werden: ${error.message}`);
  }

  revalidatePath("/einstellungen");

  return {
    ok: true,
    message: `Einladung für ${parsed.data.email} erstellt.`,
    data: { invitationUrl: await invitationUrl(token) },
  };
}

export async function revokeInvitation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionContext();
  if (!hasAdminRights(session.role)) return failed("Dafür fehlen dir die Rechte.");

  const id = text(formData.get("invitationId"));
  if (!id) return failed("Kennung der Einladung fehlt.");

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("organization_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", session.organizationId)
    .is("accepted_at", null);

  if (error) return failed(`Die Einladung konnte nicht zurückgezogen werden: ${error.message}`);

  revalidatePath("/einstellungen");
  return { ok: true, message: "Einladung zurückgezogen." };
}

export async function changeMemberRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionContext();
  if (!hasAdminRights(session.role)) return failed("Dafür fehlen dir die Rechte.");

  const memberId = text(formData.get("memberId"));
  const role = text(formData.get("role"));
  if (!memberId) return failed("Kennung des Mitglieds fehlt.");
  if (!(ORGANIZATION_ROLES as readonly string[]).includes(role)) {
    return failed("Unbekannte Rolle.");
  }
  // Nur Inhaber dürfen weitere Inhaber ernennen.
  if (role === "OWNER" && session.role !== "OWNER") {
    return failed("Nur Inhaber können weitere Inhaber ernennen.");
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("organization_members")
    .update({ role: role as OrganizationRole })
    .eq("id", memberId)
    .eq("organization_id", session.organizationId);

  if (error) return failed(describeMemberError(error.message));

  revalidatePath("/einstellungen");
  revalidatePath("/", "layout");
  return { ok: true, message: "Rolle geändert." };
}

export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSessionContext();
  if (!hasAdminRights(session.role)) return failed("Dafür fehlen dir die Rechte.");

  const memberId = text(formData.get("memberId"));
  if (!memberId) return failed("Kennung des Mitglieds fehlt.");

  const supabase = await createServerSupabase();
  const { data: ziel } = await supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("id", memberId)
    .eq("organization_id", session.organizationId)
    .maybeSingle();

  if (!ziel) return failed("Mitglied wurde nicht gefunden.");
  if (ziel.user_id === session.userId) {
    return failed("Du kannst dich nicht selbst entfernen.");
  }
  if (ziel.role === "OWNER" && session.role !== "OWNER") {
    return failed("Nur Inhaber können andere Inhaber entfernen.");
  }

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("organization_id", session.organizationId);

  if (error) return failed(describeMemberError(error.message));

  revalidatePath("/einstellungen");
  return { ok: true, message: "Mitglied entfernt." };
}

/** Nimmt eine Einladung an; die Prüfung passiert vollständig in der Datenbank. */
export async function acceptInvitation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = text(formData.get("token"));
  if (!isPlausibleToken(token)) return failed("Der Einladungslink ist ungültig.");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/einladung/${token}`)}`);

  const { error } = await supabase.rpc("accept_invitation", { invite_token: token });
  if (error) return failed(error.message);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Absolute Adresse des Einladungslinks, abgeleitet aus der aktuellen Anfrage. */
async function invitationUrl(token: string): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}/einladung/${token}`;
}

function describeMemberError(message: string): string {
  if (message.includes("letzte Inhaberin")) {
    return "Die letzte Inhaberin kann nicht entfernt oder herabgestuft werden. Ernenne zuerst eine weitere Inhaberin.";
  }
  return `Die Änderung war nicht möglich: ${message}`;
}
