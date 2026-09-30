"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createOrganization } from "@/lib/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";
import type { ActionState } from "@/lib/actions/shared";

const INITIAL: ActionState = { ok: true };

export function OrganizationForm() {
  const [state, action] = useActionState(createOrganization, INITIAL);
  return (
    <form action={action} className="space-y-3">
      {!state.ok && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <Field label="Name der Agentur" hint={state.errors?.name}>
        <Input name="name" required minLength={2} maxLength={120} placeholder="Musteragentur GmbH" />
      </Field>
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Wird angelegt …" : "Organisation anlegen"}
    </Button>
  );
}
