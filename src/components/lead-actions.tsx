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

function Submit({ idle, busy, size = "sm", variant }: {
  idle: string;
  busy: string;
  size?: "xs" | "sm" | "md";
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} variant={variant} disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

/** Statuswechsel. Abschicken per Button, damit es auch ohne JavaScript geht. */
export function StatusChanger({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [state, action] = useActionState(changeLeadStatus, INITIAL);

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex items-center gap-1.5">
        <Select name="status" defaultValue={status} aria-label="Status" className="flex-1">
          {LEAD_STATUSES.map((value) => (
            <option key={value} value={value}>
              {LEAD_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
        <Submit idle="Setzen" busy="…" />
      </div>
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}
    </form>
  );
}

/** Startet die serverseitige Analyse für den hinterlegten Lead. */
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
        Keine Website hinterlegt. Ergänze die Adresse, um eine Analyse zu starten.
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="url" value={websiteUrl} />
      <Submit idle="Website analysieren" busy="Analyse läuft …" variant="primary" />
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}
    </form>
  );
}

export function NoteForm({ leadId }: { leadId: string }) {
  const [state, action] = useActionState(addLeadNote, INITIAL);

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="leadId" value={leadId} />
      <Textarea
        name="body"
        rows={2}
        required
        maxLength={5000}
        placeholder="Was ist zu dieser Firma bekannt?"
        aria-label="Neue Notiz"
      />
      <div className="flex items-center justify-between gap-2">
        {state.message ? (
          <Alert tone={state.ok ? "success" : "error"} className="flex-1">
            {state.message}
          </Alert>
        ) : (
          <span />
        )}
        <Submit idle="Notiz speichern" busy="Speichert …" variant="secondary" />
      </div>
    </form>
  );
}

export function ArchiveButton({ leadId, archived }: { leadId: string; archived: boolean }) {
  const [state, action] = useActionState(setLeadArchived, INITIAL);

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="archive" value={archived ? "false" : "true"} />
      <Submit
        idle={archived ? "Aus Archiv holen" : "Archivieren"}
        busy="…"
        variant={archived ? "secondary" : "danger"}
      />
      {!state.ok && state.message ? <Alert tone="error">{state.message}</Alert> : null}
    </form>
  );
}

/** Freie Analyse ohne Lead-Bezug. */
export function StandaloneAnalysisForm() {
  const [state, action] = useActionState(runAnalysis, INITIAL);

  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-col gap-1.5 sm:flex-row">
        <input
          name="url"
          required
          placeholder="beispielfirma.de"
          aria-label="Website-Adresse"
          inputMode="url"
          className="h-8 w-full rounded border border-[var(--kr-line-strong)] bg-white px-2 text-[13px] placeholder:text-slate-400 focus:border-blue-600"
        />
        <Submit idle="Analysieren" busy="Analyse läuft …" size="md" variant="primary" />
      </div>
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}
      <p className="text-[11.5px] leading-relaxed text-slate-500">
        Geladen wird die öffentlich erreichbare Startseite, dazu robots.txt und sitemap.xml sowie
        eine begrenzte Stichprobe von Links und Bildern. Adressen in privaten Netzen werden
        abgewiesen – auch nach einer Weiterleitung.
      </p>
    </form>
  );
}
