"use client";

import { useFormStatus } from "react-dom";
import { signOut } from "@/lib/actions/auth";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title="Abmelden"
      className="shrink-0 rounded px-1.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
    >
      {pending ? "…" : "Abmelden"}
    </button>
  );
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Inner />
    </form>
  );
}
