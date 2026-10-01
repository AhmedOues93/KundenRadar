"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { startDiscovery } from "@/lib/actions/discovery";
import { INDUSTRIES, MAX_RESULT_OPTIONS, RADIUS_OPTIONS } from "@/lib/discovery/industries";
import { Alert, Button, Input, Select, ToolbarField } from "@/components/ui";
import type { ActionState } from "@/lib/actions/shared";

const INITIAL: ActionState = { ok: true };

/** Suchmaske als eine Zeile – auf dem Desktop bleibt die Trefferliste im Blick. */
export function DiscoveryForm({
  defaults,
}: {
  defaults?: { city?: string; radiusKm?: number; industry?: string; maxResults?: number };
}) {
  const [state, action] = useActionState(startDiscovery, INITIAL);

  return (
    <form action={action} className="space-y-1.5">
      <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5">
        <ToolbarField label="Ort" className="w-full sm:w-52">
          <Input
            name="city"
            required
            maxLength={120}
            defaultValue={defaults?.city ?? ""}
            placeholder="z. B. Köln oder 50667"
            autoComplete="address-level2"
          />
        </ToolbarField>

        <ToolbarField label="Branche" className="w-full sm:w-52">
          <Select name="industry" defaultValue={defaults?.industry ?? "elektriker"} required>
            {INDUSTRIES.map((industry) => (
              <option key={industry.key} value={industry.key}>
                {industry.label}
              </option>
            ))}
          </Select>
        </ToolbarField>

        <ToolbarField label="Radius" className="w-24">
          <Select name="radiusKm" defaultValue={String(defaults?.radiusKm ?? 10)}>
            {RADIUS_OPTIONS.map((radius) => (
              <option key={radius} value={radius}>
                {radius} km
              </option>
            ))}
          </Select>
        </ToolbarField>

        <ToolbarField label="Max. Treffer" className="w-28">
          <Select name="maxResults" defaultValue={String(defaults?.maxResults ?? 50)}>
            {MAX_RESULT_OPTIONS.map((max) => (
              <option key={max} value={max}>
                {max}
              </option>
            ))}
          </Select>
        </ToolbarField>

        <Submit />
      </div>

      {state.errors
        ? Object.values(state.errors).map((message) => (
            <Alert key={message} tone="error">
              {message}
            </Alert>
          ))
        : null}
      {!state.ok && state.message && !state.errors ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Suche läuft …" : "Firmen suchen"}
    </Button>
  );
}
