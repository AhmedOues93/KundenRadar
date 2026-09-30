"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSessionContext } from "@/lib/auth";
import { LEAD_STATUS_LABELS } from "@/lib/constants";
import { createServerSupabase } from "@/lib/supabase/server";
import { LEAD_SOURCES, LEAD_STATUSES, type LeadStatus } from "@/lib/types";
import { domainFromInput } from "@/lib/analysis/run";
import { normalizeUrl } from "@/lib/analysis/url-guard";
import { type ActionState, failed, fieldErrors, logActivity, nullable, text } from "./shared";

const leadSchema = z.object({
  company_name: z
    .string()
    .trim()
    .min(2, "Bitte den Firmennamen angeben.")
    .max(200, "Der Firmenname ist zu lang."),
  website_url: z.string().trim().max(2048).optional().nullable(),
  street: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  postal_code: z.string().trim().max(20).optional().nullable(),
  industry: z.string().trim().max(120).optional().nullable(),
  email: z.union([z.string().trim().email("Bitte eine gültige E-Mail angeben."), z.literal("")])
    .optional()
    .nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  contact_person: z.string().trim().max(120).optional().nullable(),
  source: z.enum(LEAD_SOURCES),
  status: z.enum(LEAD_STATUSES),
  notes: z.string().trim().max(5000).optional().nullable(),
});

type LeadInput = z.infer<typeof leadSchema>;

function readLeadForm(formData: FormData) {
  return leadSchema.safeParse({
    company_name: text(formData.get("company_name")),
    website_url: nullable(formData.get("website_url")),
    street: nullable(formData.get("street")),
    city: nullable(formData.get("city")),
    postal_code: nullable(formData.get("postal_code")),
    industry: nullable(formData.get("industry")),
    email: nullable(formData.get("email")) ?? "",
    phone: nullable(formData.get("phone")),
    contact_person: nullable(formData.get("contact_person")),
    source: text(formData.get("source")) || "MANUAL",
    status: text(formData.get("status")) || "NEW",
    notes: nullable(formData.get("notes")),
  });
}

/** Normalisiert die Website-Eingabe und leitet die Domain ab. */
function resolveWebsite(input: string | null | undefined): {
  websiteUrl: string | null;
  domain: string | null;
  error?: string;
} {
  if (!input) return { websiteUrl: null, domain: null };
  try {
    const url = normalizeUrl(input);
    return { websiteUrl: url.toString(), domain: domainFromInput(input) };
  } catch (error) {
    return {
      websiteUrl: null,
      domain: null,
      error: error instanceof Error ? error.message : "Die Website-Adresse ist ungültig.",
    };
  }
}

export async function createLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSessionContext();
  const parsed = readLeadForm(formData);
  if (!parsed.success) return failed("Bitte Eingaben prüfen.", fieldErrors(parsed.error));

  const website = resolveWebsite(parsed.data.website_url);
  if (website.error) {
    return failed(website.error, { website_url: website.error });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      organization_id: session.organizationId,
      ...toRow(parsed.data),
      website_url: website.websiteUrl,
      domain: website.domain,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" || error.code === "23P01" || error.code === "23514") {
      return failed(`Der Lead konnte nicht gespeichert werden: ${error.message}`);
    }
    if (error.code === "23000" || error.message.includes("leads_org_domain_key")) {
      return failed("Für diese Domain existiert in dieser Organisation bereits ein Lead.", {
        website_url: "Domain bereits erfasst.",
      });
    }
    return failed(`Der Lead konnte nicht gespeichert werden: ${error.message}`);
  }

  await logActivity(supabase, {
    organizationId: session.organizationId,
    leadId: data.id,
    type: "LEAD_CREATED",
    message: `Lead „${parsed.data.company_name}" wurde angelegt.`,
    userId: session.userId,
  });

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  redirect(`/leads/${data.id}`);
}

export async function updateLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSessionContext();
  const leadId = text(formData.get("leadId"));
  if (!leadId) return failed("Lead-Kennung fehlt.");

  const parsed = readLeadForm(formData);
  if (!parsed.success) return failed("Bitte Eingaben prüfen.", fieldErrors(parsed.error));

  const website = resolveWebsite(parsed.data.website_url);
  if (website.error) {
    return failed(website.error, { website_url: website.error });
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("leads")
    .update({
      ...toRow(parsed.data),
      website_url: website.websiteUrl,
      domain: website.domain,
    })
    .eq("id", leadId)
    .eq("organization_id", session.organizationId);

  if (error) return failed(`Änderung fehlgeschlagen: ${error.message}`);

  await logActivity(supabase, {
    organizationId: session.organizationId,
    leadId,
    type: "LEAD_UPDATED",
    message: "Lead-Daten wurden aktualisiert.",
    userId: session.userId,
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true, message: "Änderungen gespeichert." };
}

export async function changeLeadStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionContext();
  const leadId = text(formData.get("leadId"));
  const statusValue = text(formData.get("status"));

  if (!leadId) return failed("Lead-Kennung fehlt.");
  if (!isLeadStatus(statusValue)) return failed("Unbekannter Status.");

  const supabase = await createServerSupabase();
  const { data: current, error: readError } = await supabase
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .eq("organization_id", session.organizationId)
    .single();

  if (readError || !current) return failed("Lead wurde nicht gefunden.");
  if (current.status === statusValue) return { ok: true };

  const { error } = await supabase
    .from("leads")
    .update({ status: statusValue })
    .eq("id", leadId)
    .eq("organization_id", session.organizationId);

  if (error) return failed(`Status konnte nicht geändert werden: ${error.message}`);

  await logActivity(supabase, {
    organizationId: session.organizationId,
    leadId,
    type: "STATUS_CHANGED",
    message: `Status geändert: ${LEAD_STATUS_LABELS[current.status as LeadStatus]} → ${LEAD_STATUS_LABELS[statusValue]}.`,
    userId: session.userId,
    metadata: { from: current.status, to: statusValue },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return { ok: true, message: `Status ist jetzt „${LEAD_STATUS_LABELS[statusValue]}".` };
}

export async function setLeadArchived(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionContext();
  const leadId = text(formData.get("leadId"));
  const archive = text(formData.get("archive")) !== "false";
  if (!leadId) return failed("Lead-Kennung fehlt.");

  const supabase = await createServerSupabase();
  const nextStatus: LeadStatus = archive ? "ARCHIVED" : "REVIEW";
  const { error } = await supabase
    .from("leads")
    .update({ status: nextStatus })
    .eq("id", leadId)
    .eq("organization_id", session.organizationId);

  if (error) return failed(`Aktion fehlgeschlagen: ${error.message}`);

  await logActivity(supabase, {
    organizationId: session.organizationId,
    leadId,
    type: archive ? "ARCHIVED" : "RESTORED",
    message: archive ? "Lead archiviert." : "Lead aus dem Archiv geholt.",
    userId: session.userId,
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return { ok: true, message: archive ? "Lead archiviert." : "Lead wiederhergestellt." };
}

export async function addLeadNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSessionContext();
  const leadId = text(formData.get("leadId"));
  const body = text(formData.get("body"));

  if (!leadId) return failed("Lead-Kennung fehlt.");
  if (body.length < 2) return failed("Die Notiz ist zu kurz.", { body: "Bitte etwas eintragen." });
  if (body.length > 5000) return failed("Die Notiz ist zu lang (max. 5000 Zeichen).");

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("lead_notes").insert({
    organization_id: session.organizationId,
    lead_id: leadId,
    body,
    created_by: session.userId,
  });

  if (error) return failed(`Notiz konnte nicht gespeichert werden: ${error.message}`);

  await logActivity(supabase, {
    organizationId: session.organizationId,
    leadId,
    type: "NOTE_ADDED",
    message: "Notiz hinzugefügt.",
    userId: session.userId,
  });

  revalidatePath(`/leads/${leadId}`);
  return { ok: true, message: "Notiz gespeichert." };
}

function toRow(input: LeadInput) {
  return {
    company_name: input.company_name,
    street: input.street ?? null,
    city: input.city ?? null,
    postal_code: input.postal_code ?? null,
    industry: input.industry ?? null,
    email: input.email ? input.email : null,
    phone: input.phone ?? null,
    contact_person: input.contact_person ?? null,
    source: input.source,
    status: input.status,
    notes: input.notes ?? null,
  };
}

function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}
