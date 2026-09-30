"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, signUp } from "@/lib/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";
import type { ActionState } from "@/lib/actions/shared";

const INITIAL: ActionState = { ok: true };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Bitte warten …" : label}
    </Button>
  );
}

export function SignInForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action] = useActionState(signIn, INITIAL);

  return (
    <form action={action} className="space-y-3">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      {!state.ok && state.message ? <Alert tone="error">{state.message}</Alert> : null}

      <Field label="E-Mail-Adresse" hint={state.errors?.email}>
        <Input
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="name@agentur.de"
        />
      </Field>
      <Field label="Passwort" hint={state.errors?.password}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton label="Anmelden" />
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, INITIAL);

  return (
    <form action={action} className="space-y-3">
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <Field label="Name" hint={state.errors?.fullName}>
        <Input name="fullName" autoComplete="name" placeholder="Vor- und Nachname" />
      </Field>
      <Field label="E-Mail-Adresse" hint={state.errors?.email}>
        <Input name="email" type="email" autoComplete="username" required />
      </Field>
      <Field
        label="Passwort"
        hint={state.errors?.password ?? "Mindestens 8 Zeichen."}
      >
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <SubmitButton label="Konto erstellen" />
    </form>
  );
}
