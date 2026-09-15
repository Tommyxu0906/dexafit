"use client";

import { useActionState } from "react";
import { Button, Callout, Card, Field, Input, SectionHeading } from "@/components/ui";
import { saveAttestations } from "@/lib/actions/onboarding";
import { idleState } from "@/lib/actions/state";
import {
  AGREEMENT_VERSION,
  ATTESTATION_TEXT,
  ATTESTATION_TYPES,
  LEGAL_REVIEW_NOTICE,
} from "@/lib/domain/attestations";

export function AttestationsForm({
  acceptedTypes,
  signature,
  signatureDate,
  legalName,
}: {
  acceptedTypes: string[];
  signature: string | null;
  signatureDate: string | null;
  legalName: string;
}) {
  const [state, formAction, pending] = useActionState(saveAttestations, idleState);
  const errors = state.fieldErrors ?? {};
  const accepted = new Set(acceptedTypes);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <SectionHeading
        title="Privacy & attestations"
        description="These commitments govern how you represent DexaFit data and your own scope of practice."
      />

      <Callout tone="warning" title="Draft terms">
        {LEGAL_REVIEW_NOTICE} Version on file: {AGREEMENT_VERSION}.
      </Callout>

      {state.message && !state.ok ? <Callout tone="danger">{state.message}</Callout> : null}

      <Card>
        <div className="flex flex-col gap-3">
          {ATTESTATION_TYPES.map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 text-sm hover:bg-slate-50 has-checked:border-accent has-checked:bg-emerald-50/40"
            >
              <input
                type="checkbox"
                name="accepted"
                value={type}
                defaultChecked={accepted.has(type)}
                className="mt-1 h-4 w-4 accent-emerald-600"
                required
              />
              <span className="leading-relaxed text-ink">{ATTESTATION_TEXT[type]}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <p className="mb-4 text-sm font-semibold text-ink">Electronic signature</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Type your full legal name"
            htmlFor="electronicSignature"
            required
            error={errors.electronicSignature}
          >
            <Input
              id="electronicSignature"
              name="electronicSignature"
              defaultValue={signature ?? legalName}
              required
            />
          </Field>
          <Field label="Date" htmlFor="signatureDate" required error={errors.signatureDate}>
            <Input
              id="signatureDate"
              name="signatureDate"
              type="date"
              defaultValue={signatureDate ?? today}
              required
            />
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted">
          We record the date, time and IP address of your acceptance alongside the version
          of the terms shown above.
        </p>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save and review"}
        </Button>
      </div>
    </form>
  );
}
