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
  ASSESSMENT_FINDINGS,
  ASSESSMENT_GROUPS,
  ASSESSMENT_GROUP_LABELS,
  FINDING_GROUP,
  CLIENT_POPULATIONS,
  allowedCapabilities,
  type CapabilityCode,
} from "@/lib/domain/capabilities";
import { PROFESSION_LABELS, type ProfessionType } from "@/lib/domain/enums";

export function CapabilitiesForm({
  professionTypes,
  selected,
}: {
  professionTypes: readonly ProfessionType[];
  selected: string[];
}) {
  const [state, formAction, pending] = useActionState(saveCapabilities, idleState);
  const errors = state.fieldErrors ?? {};

  // Only in-scope options are rendered at all — out-of-scope clinical capabilities
  // are never offered to professions that cannot lawfully claim them.
  const allowed = new Set(allowedCapabilities(professionTypes));
  const populations = CLIENT_POPULATIONS.filter((c) => allowed.has(c));
  const findings = ASSESSMENT_FINDINGS.filter((c) => allowed.has(c));
  // Grouped by the test that produces the finding, so a provider is choosing
  // against something real rather than a flat wall of jargon.
  const findingGroups = ASSESSMENT_GROUPS.map((group) => ({
    group,
    codes: findings.filter((c) => FINDING_GROUP[c] === group),
  })).filter((g) => g.codes.length > 0);
  const clinical = [...allowed].filter(
    (c) =>
      !(CLIENT_POPULATIONS as readonly string[]).includes(c) &&
      !(ASSESSMENT_FINDINGS as readonly string[]).includes(c),
  ) as CapabilityCode[];

  const chosen = new Set(selected);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <SectionHeading
        title="Who you help"
        description="These tags decide which DexaFit customers you are surfaced to once scan-based matching goes live."
      />

      <Callout tone="info">
        Options are limited to what a{" "}
        {professionTypes.map((t) => PROFESSION_LABELS[t].toLowerCase()).join(" or ")} may
        lawfully provide.
      </Callout>

      {state.message && !state.ok ? <Callout tone="danger">{state.message}</Callout> : null}

      <Card>
        <p className="mb-1 text-sm font-semibold text-ink">Client populations</p>
        <p className="mb-4 text-xs text-muted">Select every group you work with, and what they come to you for.</p>
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
        <p className="mb-1 text-sm font-semibold text-ink">
          Assessment findings you can act on
        </p>
        <p className="mb-4 text-xs text-muted">
          DexaFit measures body composition and bone density by DEXA scan,
          cardiorespiratory fitness by VO&#8322; max test, and metabolic rate by RMR
          test. Select the results you are equipped to act on.
        </p>
        {errors.dexaCapabilities ? (
          <p className="mb-3 text-xs font-medium text-rose-600">{errors.dexaCapabilities}</p>
        ) : null}
        <div className="flex flex-col gap-5">
          {findingGroups.map(({ group, codes }) => (
            <div key={group}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {ASSESSMENT_GROUP_LABELS[group]}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {codes.map((code) => (
                  <CheckboxRow
                    key={code}
                    name="dexaCapabilities"
                    value={code}
                    label={CAPABILITY_LABELS[code]}
                    defaultChecked={chosen.has(code)}
                  />
                ))}
              </div>
            </div>
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
