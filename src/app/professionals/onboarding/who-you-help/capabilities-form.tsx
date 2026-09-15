"use client";

import { useActionState } from "react";
import {
  Button,
  Callout,
  Card,
  CheckboxRow,
  SectionHeading,
} from "@/components/ui";
import { saveCapabilities } from "@/lib/actions/onboarding";
import { idleState } from "@/lib/actions/state";
import {
  CAPABILITY_LABELS,
  CLIENT_POPULATIONS,
  DEXA_CAPABILITIES,
  allowedCapabilities,
  type CapabilityCode,
} from "@/lib/domain/capabilities";
import { PROFESSION_LABELS, type ProfessionType } from "@/lib/domain/enums";

export function CapabilitiesForm({
  professionType,
  selected,
}: {
  professionType: ProfessionType;
  selected: string[];
}) {
  const [state, formAction, pending] = useActionState(saveCapabilities, idleState);
  const errors = state.fieldErrors ?? {};

  // Only in-scope options are rendered at all — out-of-scope clinical capabilities
  // are never offered to professions that cannot lawfully claim them.
  const allowed = new Set(allowedCapabilities(professionType));
  const populations = CLIENT_POPULATIONS.filter((c) => allowed.has(c));
  const dexa = DEXA_CAPABILITIES.filter((c) => allowed.has(c));
  const clinical = [...allowed].filter(
    (c) =>
      !(CLIENT_POPULATIONS as readonly string[]).includes(c) &&
      !(DEXA_CAPABILITIES as readonly string[]).includes(c),
  ) as CapabilityCode[];

  const chosen = new Set(selected);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <SectionHeading
        title="Who you help"
        description="These tags decide which DexaFit customers you are surfaced to once scan-based matching goes live."
      />

      <Callout tone="info">
        Options are limited to what a {PROFESSION_LABELS[professionType].toLowerCase()} may
        lawfully provide.
      </Callout>

      {state.message && !state.ok ? <Callout tone="danger">{state.message}</Callout> : null}

      <Card>
        <p className="mb-1 text-sm font-semibold text-ink">Client populations</p>
        <p className="mb-4 text-xs text-muted">Select every group you work with.</p>
        {errors.clientPopulations ? (
          <p className="mb-3 text-xs font-medium text-rose-600">{errors.clientPopulations}</p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {populations.map((code) => (
            <CheckboxRow
              key={code}
              name="clientPopulations"
              value={code}
              label={CAPABILITY_LABELS[code]}
              defaultChecked={chosen.has(code)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <p className="mb-1 text-sm font-semibold text-ink">DEXA findings you can address</p>
        <p className="mb-4 text-xs text-muted">
          Which scan results are you equipped to act on?
        </p>
        {errors.dexaCapabilities ? (
          <p className="mb-3 text-xs font-medium text-rose-600">{errors.dexaCapabilities}</p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {dexa.map((code) => (
            <CheckboxRow
              key={code}
              name="dexaCapabilities"
              value={code}
              label={CAPABILITY_LABELS[code]}
              defaultChecked={chosen.has(code)}
            />
          ))}
        </div>
      </Card>

      {clinical.length > 0 ? (
        <Card>
          <p className="mb-1 text-sm font-semibold text-ink">Clinical services</p>
          <p className="mb-4 text-xs text-muted">
            Available to you because of your license. Subject to credential verification.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {clinical.map((code) => (
              <CheckboxRow
                key={code}
                name="dexaCapabilities"
                value={code}
                label={CAPABILITY_LABELS[code]}
                defaultChecked={chosen.has(code)}
              />
            ))}
          </div>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save and continue"}
        </Button>
      </div>
    </form>
  );
}
