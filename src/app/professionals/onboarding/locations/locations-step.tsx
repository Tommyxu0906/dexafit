"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Field,
  Input,
  SectionHeading,
  Select,
} from "@/components/ui";
import {
  completeLocationsStep,
  deleteLocation,
  saveLocation,
} from "@/lib/actions/onboarding";
import { idleState } from "@/lib/actions/state";
import type {
  CredentialRow,
  JurisdictionRow,
  ServiceLocationRow,
} from "@/lib/data/types";
import {
  DEFAULT_COUNTRY,
  DEFAULT_STATE,
  SERVICE_MODES,
  SERVICE_MODE_LABELS,
  US_STATES,
  type ProfessionType,
} from "@/lib/domain/enums";
import { getRequirements } from "@/lib/domain/requirements";

export function LocationsStep({
  professionTypes,
  locations,
  jurisdictions,
  credentials,
}: {
  professionTypes: readonly ProfessionType[];
  locations: ServiceLocationRow[];
  jurisdictions: JurisdictionRow[];
  credentials: CredentialRow[];
}) {
  const [adding, setAdding] = useState(locations.length === 0);
  const [editing, setEditing] = useState<string | null>(null);

  // States the professional claims but holds no license in. Licensed professions
  // cannot be listed there, so surface it before a reviewer has to catch it.
  const licensedStates = new Set(
    credentials
      .filter((c) =>
        ["STATE_LICENSE", "RN_LICENSE", "APRN_AUTHORIZATION"].includes(c.credential_type),
      )
      .map((c) => c.jurisdiction_state)
      .filter(Boolean),
  );

  const needsLicense = getRequirements(
    professionTypes,
    DEFAULT_STATE,
  ).credentials.some((c) => c.required && c.legalRequirement);

  const unlicensedStates = needsLicense
    ? locations.map((l) => l.state).filter((s) => !licensedStates.has(s))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Where you practice"
        description="Add each place you see clients, plus virtual coverage. DexaFit is launching in Massachusetts, but your profile is built to travel."
      />

      {unlicensedStates.length > 0 ? (
        <Callout tone="warning" title="License needed for these states">
          You listed {[...new Set(unlicensedStates)].join(", ")} but have no license on
          file issued there. Add the license in step 3, or remove the location.
        </Callout>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Practice locations</p>
          {!adding ? (
            <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
              Add location
            </Button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {locations.length === 0 && !adding ? (
            <EmptyState>No locations yet.</EmptyState>
          ) : null}

          {locations.map((location) =>
            editing === location.id ? (
              <LocationForm
                key={location.id}
                location={location}
                onDone={() => setEditing(null)}
              />
            ) : (
              <LocationSummary
                key={location.id}
                location={location}
                jurisdiction={jurisdictions.find((j) => j.state === location.state) ?? null}
                hasLicense={!needsLicense || licensedStates.has(location.state)}
                onEdit={() => setEditing(location.id)}
              />
            ),
          )}

          {adding ? <LocationForm location={null} onDone={() => setAdding(false)} /> : null}
        </div>
      </Card>

      <form action={completeLocationsStep} className="flex justify-end">
        <Button type="submit" disabled={locations.length === 0}>
          Save and continue
        </Button>
      </form>
    </div>
  );
}

function LocationSummary({
  location,
  jurisdiction,
  hasLicense,
  onEdit,
}: {
  location: ServiceLocationRow;
  jurisdiction: JurisdictionRow | null;
  hasLicense: boolean;
  onEdit: () => void;
}) {
  const [, deleteAction, deletePending] = useActionState(deleteLocation, idleState);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-slate-50 p-4">
      <div>
        <p className="text-sm font-semibold text-ink">
          {[location.city, location.state].filter(Boolean).join(", ")}
        </p>
        <p className="mt-1 text-xs text-muted">
          {[location.address_1, location.address_2, location.postal_code]
            .filter(Boolean)
            .join(" · ") || "No street address"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="info">{SERVICE_MODE_LABELS[location.service_mode]}</Badge>
          {hasLicense ? (
            jurisdiction?.credential_id ? (
              <Badge tone="success">License linked</Badge>
            ) : null
          ) : (
            <Badge tone="warning">No license on file</Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={location.id} />
          <Button type="submit" variant="danger" disabled={deletePending}>
            Remove
          </Button>
        </form>
      </div>
    </div>
  );
}

function LocationForm({
  location,
  onDone,
}: {
  location: ServiceLocationRow | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveLocation, idleState);
  const errors = state.fieldErrors ?? {};
  const key = location?.id ?? "new";

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="rounded-xl border border-accent/40 bg-white p-4">
      {location ? <input type="hidden" name="id" value={location.id} /> : null}
      <input type="hidden" name="country" value={DEFAULT_COUNTRY} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="State" htmlFor={`state-${key}`} required error={errors.state}>
          <Select
            id={`state-${key}`}
            name="state"
            defaultValue={location?.state ?? DEFAULT_STATE}
          >
            {US_STATES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Delivery at this location" htmlFor={`mode-${key}`} required>
          <Select
            id={`mode-${key}`}
            name="serviceMode"
            defaultValue={location?.service_mode ?? "IN_PERSON"}
          >
            {SERVICE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {SERVICE_MODE_LABELS[mode]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="City" htmlFor={`city-${key}`}>
          <Input id={`city-${key}`} name="city" defaultValue={location?.city ?? ""} />
        </Field>
        <Field label="Postal code" htmlFor={`postal-${key}`}>
          <Input
            id={`postal-${key}`}
            name="postalCode"
            defaultValue={location?.postal_code ?? ""}
          />
        </Field>
        <Field label="Address line 1" htmlFor={`address1-${key}`}>
          <Input
            id={`address1-${key}`}
            name="address1"
            defaultValue={location?.address_1 ?? ""}
          />
        </Field>
        <Field label="Address line 2" htmlFor={`address2-${key}`}>
          <Input
            id={`address2-${key}`}
            name="address2"
            defaultValue={location?.address_2 ?? ""}
          />
        </Field>
      </div>

      {state.message && !state.ok ? (
        <p className="mt-3 text-xs font-medium text-rose-600">{state.message}</p>
      ) : null}

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save location"}
        </Button>
      </div>
    </form>
  );
}
