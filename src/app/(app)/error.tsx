"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Alert, Button, Panel, PanelBody, buttonClasses } from "@/components/ui";

/**
 * Auffangnetz für Fehler innerhalb der Anwendung. Ohne diese Grenze würde eine
 * fehlgeschlagene Abfrage die komplette Seite in einen Standardfehler kippen.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Fehler in der Anwendung:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-8">
      <Panel>
        <PanelBody className="space-y-2.5">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Etwas ist schiefgelaufen</h1>
            <p className="mt-0.5 text-[12.5px] text-slate-600">
              Die Seite konnte nicht geladen werden. Ein erneuter Versuch hilft oft schon.
            </p>
          </div>

          <Alert tone="error">
            {error.message || "Unbekannter Fehler."}
            {error.digest ? (
              <span className="ml-1 font-mono text-[11px] opacity-70">({error.digest})</span>
            ) : null}
          </Alert>

          <div className="flex flex-wrap gap-1.5">
            <Button type="button" onClick={reset}>
              Erneut versuchen
            </Button>
            <Link href="/dashboard" className={buttonClasses("secondary")}>
              Zum Dashboard
            </Link>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
