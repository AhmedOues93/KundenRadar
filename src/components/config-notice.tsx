import { Alert } from "@/components/ui";
import { MISSING_CONFIG_MESSAGE } from "@/lib/env";

/**
 * Wird gezeigt, solange keine Supabase-Zugangsdaten hinterlegt sind. So bleibt
 * die App ohne Konfiguration lauf- und baufähig.
 */
export function ConfigNotice() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Alert tone="warning" title="Einrichtung erforderlich">
        <p>{MISSING_CONFIG_MESSAGE}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Supabase-Projekt anlegen und die Migrationen aus <code>supabase/migrations</code>{" "}
            einspielen.
          </li>
          <li>
            <code>.env.example</code> nach <code>.env.local</code> kopieren und die Werte
            eintragen.
          </li>
          <li>Entwicklungsserver neu starten.</li>
        </ol>
      </Alert>
    </div>
  );
}
