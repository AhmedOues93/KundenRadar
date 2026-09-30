"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createLead, updateLead } from "@/lib/actions/leads";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from "@/lib/constants";
import { LEAD_SOURCES, LEAD_STATUSES, type Lead } from "@/lib/types";
import {
  Alert,
  Button,
  Field,
  Input,
  Select,
  Textarea,
  buttonClasses,
} from "@/components/ui";
import type { ActionState } from "@/lib/actions/shared";

const INITIAL: ActionState = { ok: true };

export function LeadForm({ lead }: { lead?: Lead }) {
  const isEdit = Boolean(lead);
  const [state, action] = useActionState(isEdit ? updateLead : createLead, INITIAL);

  return (
    <form action={action} className="space-y-4">
      {lead ? <input type="hidden" name="leadId" value={lead.id} /> : null}
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Firmenname *" hint={state.errors?.company_name} className="sm:col-span-2">
          <Input
            name="company_name"
            required
            maxLength={200}
            defaultValue={lead?.company_name ?? ""}
            placeholder="Musterfirma GmbH"
          />
        </Field>

        <Field
          label="Website"
          hint={state.errors?.website_url ?? "Ohne https:// genügt ebenfalls."}
          className="sm:col-span-2"
        >
          <Input
            name="website_url"
            defaultValue={lead?.website_url ?? ""}
            placeholder="musterfirma.de"
            inputMode="url"
          />
        </Field>

        <Field label="Strasse und Hausnummer" hint={state.errors?.street} className="sm:col-span-2">
          <Input name="street" maxLength={200} defaultValue={lead?.street ?? ""} />
        </Field>

        <Field label="Postleitzahl" hint={state.errors?.postal_code}>
          <Input name="postal_code" maxLength={20} defaultValue={lead?.postal_code ?? ""} />
        </Field>
        <Field label="Ort" hint={state.errors?.city}>
          <Input name="city" maxLength={120} defaultValue={lead?.city ?? ""} />
        </Field>

        <Field label="Branche" hint={state.errors?.industry}>
          <Input
            name="industry"
            maxLength={120}
            defaultValue={lead?.industry ?? ""}
            placeholder="z. B. Handwerk, Gastronomie"
          />
        </Field>
        <Field label="Ansprechpartner" hint={state.errors?.contact_person}>
          <Input name="contact_person" maxLength={120} defaultValue={lead?.contact_person ?? ""} />
        </Field>

        <Field label="E-Mail" hint={state.errors?.email}>
          <Input name="email" type="email" defaultValue={lead?.email ?? ""} />
        </Field>
        <Field label="Telefon" hint={state.errors?.phone}>
          <Input name="phone" maxLength={60} defaultValue={lead?.phone ?? ""} />
        </Field>

        <Field label="Quelle" hint={state.errors?.source}>
          <Select name="source" defaultValue={lead?.source ?? "MANUAL"}>
            {LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {LEAD_SOURCE_LABELS[source]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" hint={state.errors?.status}>
          <Select name="status" defaultValue={lead?.status ?? "NEW"}>
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {LEAD_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Interne Notiz" hint={state.errors?.notes} className="sm:col-span-2">
          <Textarea
            name="notes"
            maxLength={5000}
            rows={3}
            defaultValue={lead?.notes ?? ""}
            placeholder="Kurzer Kontext zu dieser Firma"
          />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <Submit label={isEdit ? "Änderungen speichern" : "Lead anlegen"} />
        <Link
          href={lead ? `/leads/${lead.id}` : "/leads"}
          className={buttonClasses("secondary")}
        >
          Abbrechen
        </Link>
      </div>
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird gespeichert …" : label}
    </Button>
  );
}
