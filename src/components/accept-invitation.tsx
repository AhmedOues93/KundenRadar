"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { acceptInvitation } from "@/lib/actions/team";
import { Alert, Button } from "@/components/ui";
import type { ActionState } from "@/lib/actions/shared";

const INITIAL: ActionState = { ok: true };

export function AcceptInvitationForm({
  token,
  organizationName,
}: {
  token: string;
  organizationName: string;
}) {
  const [state, action] = useActionState(acceptInvitation, INITIAL);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="token" value={token} />
      {!state.ok && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <Submit organizationName={organizationName} />
    </form>
  );
}

function Submit({ organizationName }: { organizationName: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Wird angenommen …" : `${organizationName} beitreten`}
    </Button>
  );
}
