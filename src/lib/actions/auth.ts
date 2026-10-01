"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safeRedirectTarget } from "@/lib/safe-redirect";
import { createServerSupabase } from "@/lib/supabase/server";
import { type ActionState, failed, fieldErrors, text } from "./shared";

const credentialsSchema = z.object({
  email: z.string().trim().min(3, "E-Mail fehlt.").email("Bitte eine gültige E-Mail angeben."),
  password: z.string().min(8, "Das Passwort muss mindestens 8 Zeichen haben."),
});

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    email: text(formData.get("email")),
    password: text(formData.get("password")),
  });

  if (!parsed.success) {
    return failed("Bitte Eingaben prüfen.", fieldErrors(parsed.error));
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Bewusst unspezifisch: keine Auskunft darüber, ob die E-Mail existiert.
    return failed("E-Mail oder Passwort ist nicht korrekt.");
  }

  revalidatePath("/", "layout");
  redirect(safeRedirectTarget(text(formData.get("redirectTo"))));
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    email: text(formData.get("email")),
    password: text(formData.get("password")),
  });

  if (!parsed.success) {
    return failed("Bitte Eingaben prüfen.", fieldErrors(parsed.error));
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { data: { full_name: text(formData.get("fullName")) || null } },
  });

  if (error) {
    return failed(error.message);
  }

  // Ist die E-Mail-Bestätigung aktiv, gibt es noch keine Session.
  if (!data.session) {
    return {
      ok: true,
      message: "Konto erstellt. Bitte bestätige zuerst die E-Mail-Adresse und melde dich dann an.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/** Legt die erste Organisation an; der Aufrufer wird dabei OWNER. */
export async function createOrganization(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = text(formData.get("name"));
  if (name.length < 2) {
    return failed("Bitte einen Namen mit mindestens 2 Zeichen angeben.", {
      name: "Name zu kurz.",
    });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("create_organization", { org_name: name });
  if (error) {
    // Das Onboarding ist einmalig (siehe Migration 0005). Wer schon zu einer
    // Organisation gehört, landet direkt in der Anwendung.
    if (error.message.includes("gehört bereits zu einer Organisation")) {
      revalidatePath("/", "layout");
      redirect("/dashboard");
    }
    return failed(`Organisation konnte nicht angelegt werden: ${error.message}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
