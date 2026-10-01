import { Alert } from "@/components/ui";
import { MISSING_CONFIG_MESSAGE } from "@/lib/env";

/** Wird gezeigt, solange keine Supabase-Zugangsdaten hinterlegt sind. */
export function ConfigNotice() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="mb-3 text-[15px] font-semibold text-slate-900">KundenRadar</p>
      <Alert tone="warning" title="Einrichtung erforderlich">
        <p>{MISSING_CONFIG_MESSAGE}</p>
        <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
          <li>
            Supabase-Projekt anlegen und die Migrationen aus <code>supabase/migrations</code> der
            Reihe nach einspielen.
          </li>
          <li>
            <code>.env.example</code> nach <code>.env.local</code> kopieren und die Werte eintragen.
          </li>
          <li>Entwicklungsserver neu starten.</li>
        </ol>
      </Alert>
    </div>
  );
}
