"use client";

import { useFormStatus } from "react-dom";
import { signOut } from "@/lib/actions/auth";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs font-medium text-slate-500 underline hover:text-slate-800 disabled:opacity-60"
    >
      {pending ? "Wird abgemeldet …" : "Abmelden"}
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
