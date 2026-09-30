"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { startDiscovery } from "@/lib/actions/discovery";
import { INDUSTRIES, MAX_RESULT_OPTIONS, RADIUS_OPTIONS } from "@/lib/discovery/industries";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import type { ActionState } from "@/lib/actions/shared";

const INITIAL: ActionState = { ok: true };

/**
 * Suchmaske. Mobile-first: einspaltig, ab `sm` zweispaltig – auf dem
 * Smartphone vollständig bedienbar.
 */
export function DiscoveryForm({
  defaults,
}: {
  defaults?: { city?: string; radiusKm?: number; industry?: string; maxResults?: number };
}) {
  const [state, action] = useActionState(startDiscovery, INITIAL);

  return (
    <form action={action} className="space-y-3">
      {!state.ok && state.message ? <Alert tone="error">{state.message}</Alert> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Ort" hint={state.errors?.city} className="sm:col-span-2">
          <Input
            name="city"
            required
            maxLength={120}
            defaultValue={defaults?.city ?? ""}
            placeholder="z. B. Köln oder 50667 Köln"
            autoComplete="address-level2"
          />
        </Field>

        <Field label="Branche" hint={state.errors?.industry}>
          <Select name="industry" defaultValue={defaults?.industry ?? "elektriker"} required>
            {INDUSTRIES.map((industry) => (
              <option key={industry.key} value={industry.key}>
                {industry.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Radius" hint={state.errors?.radiusKm}>
          <Select name="radiusKm" defaultValue={String(defaults?.radiusKm ?? 10)}>
            {RADIUS_OPTIONS.map((radius) => (
              <option key={radius} value={radius}>
                {radius} km
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Maximale Anzahl Ergebnisse"
          hint={state.errors?.maxResults}
          className="sm:col-span-2"
        >
          <Select name="maxResults" defaultValue={String(defaults?.maxResults ?? 50)}>
            {MAX_RESULT_OPTIONS.map((max) => (
              <option key={max} value={max}>
                {max} Treffer
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Submit />

      <p className="text-xs text-slate-500">
        Datenquelle: OpenStreetMap über die öffentliche Overpass-API. Die Suche stellt eine Abfrage
        pro Durchlauf und respektiert die Nutzungsbedingungen der Quelle. Es findet kein Scraping
        von Google Maps oder LinkedIn statt.
      </p>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Suche läuft – bitte warten …" : "Firmen suchen"}
    </Button>
  );
}
