"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addLeadNote, changeLeadStatus, setLeadArchived } from "@/lib/actions/leads";
import { runAnalysis } from "@/lib/actions/analysis";
import { LEAD_STATUS_LABELS } from "@/lib/constants";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/types";
import { Alert, Button, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/actions/shared";

const INITIAL: ActionState = { ok: true };

function Pending({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

/** Status ändern. Abschicken über den Button, damit auch ohne JS gespeichert wird. */
export function StatusChanger({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [state, action] = useActionState(changeLeadStatus, INITIAL);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex items-center gap-2">
        <Select name="status" defaultValue={status} aria-label="Status" className="max-w-56">
          {LEAD_STATUSES.map((value) => (
            <option key={value} value={value}>
              {LEAD_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
        <Pending idle="Übernehmen" busy="Speichert …" />
      </div>
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}
    </form>
  );
}

/**
 * Startet die serverseitige Website-Analyse. Der Button bleibt während des
 * Laufs deaktiviert, weil die Analyse einige Sekunden dauern kann.
 */
export function AnalyzeButton({
  leadId,
  websiteUrl,
}: {
  leadId: string;
  websiteUrl: string | null;
}) {
  const [state, action] = useActionState(runAnalysis, INITIAL);

  if (!websiteUrl) {
    return (
      <Alert tone="warning">
        Für diesen Lead ist keine Website hinterlegt. Ergänze die Adresse, um eine Analyse zu
        starten.
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="url" value={websiteUrl} />
      <Pending idle="Website analysieren" busy="Analyse läuft …" />
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}
    </form>
  );
}

export function NoteForm({ leadId }: { leadId: string }) {
  const [state, action] = useActionState(addLeadNote, INITIAL);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <Textarea
        name="body"
        rows={3}
        required
        maxLength={5000}
        placeholder="Was ist zu dieser Firma bekannt?"
        aria-label="Neue Notiz"
      />
      <div className="flex items-center gap-2">
        <Pending idle="Notiz hinzufügen" busy="Speichert …" />
      </div>
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}
    </form>
  );
}

export function ArchiveButton({ leadId, archived }: { leadId: string; archived: boolean }) {
  const [state, action] = useActionState(setLeadArchived, INITIAL);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="archive" value={archived ? "false" : "true"} />
      <ArchiveSubmit archived={archived} />
      {!state.ok && state.message ? <Alert tone="error">{state.message}</Alert> : null}
    </form>
  );
}

function ArchiveSubmit({ archived }: { archived: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={archived ? "secondary" : "danger"} disabled={pending}>
      {pending ? "Bitte warten …" : archived ? "Aus Archiv holen" : "Lead archivieren"}
    </Button>
  );
}

/** Freie Analyse ohne Lead-Bezug, z. B. für eine erste Einschätzung. */
export function StandaloneAnalysisForm() {
  const [state, action] = useActionState(runAnalysis, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="url"
          required
          placeholder="beispielfirma.de"
          aria-label="Website-Adresse"
          inputMode="url"
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm placeholder:text-slate-400"
        />
        <Pending idle="Analysieren" busy="Analyse läuft …" />
      </div>
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}
      <p className="text-xs text-slate-500">
        Es wird ausschliesslich die öffentlich erreichbare Startseite geladen, dazu robots.txt und
        sitemap.xml sowie eine begrenzte Stichprobe von Links und Bildern. Adressen in privaten
        Netzen werden abgewiesen.
      </p>
    </form>
  );
}
