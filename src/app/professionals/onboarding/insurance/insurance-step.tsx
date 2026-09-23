"use client";

import { useActionState, useEffect, useState } from "react";
import { DocumentUpload, type UploadedDocument } from "@/components/document-upload";
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
  deleteInsurance,
  saveComplianceStep,
  saveInsurance,
} from "@/lib/actions/onboarding";
import { idleState } from "@/lib/actions/state";
import type {
  ComplianceDisclosureRow,
  DocumentRow,
  InsurancePolicyRow,
} from "@/lib/data/types";
import {
  DISCLOSURE_QUESTIONS,
  DISCLOSURE_TYPES,
  INSURANCE_TYPES,
  INSURANCE_TYPE_LABELS,
} from "@/lib/domain/enums";

export function InsuranceStep({
  policies,
  disclosures,
  documents,
}: {
  policies: InsurancePolicyRow[];
  disclosures: ComplianceDisclosureRow[];
  documents: DocumentRow[];
}) {
  const [state, formAction, pending] = useActionState(saveComplianceStep, idleState);
  const [adding, setAdding] = useState(policies.length === 0);
  const [editing, setEditing] = useState<string | null>(null);
  const errors = state.fieldErrors ?? {};

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Insurance & compliance"
        description="Coverage and disclosures are reviewed by DexaFit's credentialing team before you are listed."
      />

      <Callout tone="info" title="DexaFit marketplace requirement">
        Professional liability coverage is required by DexaFit to list on the marketplace.
        We collect your coverage amounts but do not currently enforce a minimum.
      </Callout>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Insurance policies</p>
          {!adding ? (
            <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
              Add policy
            </Button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {policies.length === 0 && !adding ? (
            <EmptyState>No insurance on file yet.</EmptyState>
          ) : null}

          {policies.map((policy) =>
            editing === policy.id ? (
              <InsuranceForm
                key={policy.id}
                policy={policy}
                document={
                  documents.find((d) => d.id === policy.certificate_document_id) ?? null
                }
                onDone={() => setEditing(null)}
              />
            ) : (
              <PolicySummary
                key={policy.id}
                policy={policy}
                onEdit={() => setEditing(policy.id)}
              />
            ),
          )}

          {adding ? (
            <InsuranceForm policy={null} document={null} onDone={() => setAdding(false)} />
          ) : null}
        </div>
      </Card>

      <form action={formAction} className="flex flex-col gap-6">
        <Card>
          <p className="mb-1 text-sm font-semibold text-ink">Compliance disclosures</p>
          <p className="mb-4 text-xs text-muted">
            Answering yes does not automatically disqualify you. It routes your application
            to a DexaFit reviewer.
          </p>

          <div className="flex flex-col gap-5">
            {DISCLOSURE_TYPES.map((type) => (
              <DisclosureQuestion
                key={type}
                type={type}
                existing={disclosures.find((d) => d.disclosure_type === type) ?? null}
                document={
                  documents.find(
                    (d) =>
                      d.id ===
                      disclosures.find((x) => x.disclosure_type === type)
                        ?.supporting_document_id,
                  ) ?? null
                }
                error={errors[`${type}.explanation`]}
              />
            ))}
          </div>
        </Card>

        {state.message && !state.ok ? (
          <Callout tone="danger">{state.message}</Callout>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save and continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PolicySummary({
  policy,
  onEdit,
}: {
  policy: InsurancePolicyRow;
  onEdit: () => void;
}) {
  const [, deleteAction, deletePending] = useActionState(deleteInsurance, idleState);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-slate-50 p-4">
      <div>
        <p className="text-sm font-semibold text-ink">
          {INSURANCE_TYPE_LABELS[policy.insurance_type]} · {policy.carrier_name}
        </p>
        <p className="mt-1 text-xs text-muted">
          #{policy.policy_number} · Expires {policy.expiration_date ?? "—"}
          {policy.coverage_per_claim
            ? ` · $${Number(policy.coverage_per_claim).toLocaleString()} per claim`
            : ""}
        </p>
        <div className="mt-2">
          <Badge tone={policy.status === "VERIFIED" ? "success" : "neutral"}>
            {policy.status.toLowerCase()}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={policy.id} />
          <Button type="submit" variant="danger" disabled={deletePending}>
            Remove
          </Button>
        </form>
      </div>
    </div>
  );
}

function InsuranceForm({
  policy,
  document,
  onDone,
}: {
  policy: InsurancePolicyRow | null;
  document: DocumentRow | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveInsurance, idleState);
  const [certificate, setCertificate] = useState<UploadedDocument | null>(
    document ? { id: document.id, original_filename: document.original_filename } : null,
  );
  const errors = state.fieldErrors ?? {};
  const key = policy?.id ?? "new";

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="rounded-xl border border-accent/40 bg-white p-4">
      {policy ? <input type="hidden" name="id" value={policy.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Coverage type" htmlFor={`type-${key}`} required>
          <Select
            id={`type-${key}`}
            name="insuranceType"
            defaultValue={policy?.insurance_type ?? "PROFESSIONAL_LIABILITY"}
          >
            {INSURANCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {INSURANCE_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Carrier" htmlFor={`carrier-${key}`} required error={errors.carrierName}>
          <Input
            id={`carrier-${key}`}
            name="carrierName"
            defaultValue={policy?.carrier_name ?? ""}
            required
          />
        </Field>
        <Field label="Policy number" htmlFor={`policy-${key}`} required error={errors.policyNumber}>
          <Input
            id={`policy-${key}`}
            name="policyNumber"
            defaultValue={policy?.policy_number ?? ""}
            required
          />
        </Field>
        <Field label="Coverage per claim (USD)" htmlFor={`perclaim-${key}`} required>
          <Input
            id={`perclaim-${key}`}
            name="coveragePerClaim"
            type="number"
            min={0}
            step={1000}
            defaultValue={policy?.coverage_per_claim ?? ""}
            required
          />
        </Field>
        <Field label="Aggregate coverage (USD)" htmlFor={`aggregate-${key}`} required>
          <Input
            id={`aggregate-${key}`}
            name="coverageAggregate"
            type="number"
            min={0}
            step={1000}
            defaultValue={policy?.coverage_aggregate ?? ""}
            required
          />
        </Field>
        <Field label="Effective date" htmlFor={`effective-${key}`} required error={errors.effectiveDate}>
          <Input
            id={`effective-${key}`}
            name="effectiveDate"
            type="date"
            defaultValue={policy?.effective_date ?? ""}
            required
          />
        </Field>
        <Field label="Expiration date" htmlFor={`expires-${key}`} required error={errors.expirationDate}>
          <Input
            id={`expires-${key}`}
            name="expirationDate"
            type="date"
            defaultValue={policy?.expiration_date ?? ""}
            required
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field
          label="Certificate of insurance (optional)"
          hint="Not required to submit. Attaching it lets us verify the policy without coming back to you."
          error={errors.certificateDocumentId}
        >
          <DocumentUpload
            name="certificateDocumentId"
            documentType="INSURANCE_CERTIFICATE"
            value={certificate}
            onChange={setCertificate}
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
          {pending ? "Saving…" : "Save policy"}
        </Button>
      </div>
    </form>
  );
}

function DisclosureQuestion({
  type,
  existing,
  document,
  error,
}: {
  type: (typeof DISCLOSURE_TYPES)[number];
  existing: ComplianceDisclosureRow | null;
  document: DocumentRow | null;
  error?: string;
}) {
  const [answer, setAnswer] = useState(existing?.answer ?? false);
  const [supporting, setSupporting] = useState<UploadedDocument | null>(
    document ? { id: document.id, original_filename: document.original_filename } : null,
  );

  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-sm leading-relaxed text-ink">{DISCLOSURE_QUESTIONS[type]}</p>
      <div className="mt-3 flex gap-2">
        {[
          { label: "No", value: false },
          { label: "Yes", value: true },
        ].map((option) => (
          <label
            key={option.label}
            className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              answer === option.value
                ? "border-accent bg-emerald-50 text-accent-ink"
                : "border-line bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name={`${type}.answer`}
              value={String(option.value)}
              checked={answer === option.value}
              onChange={() => setAnswer(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>

      {answer ? (
        <div className="mt-4 flex flex-col gap-3">
          <Field label="Explanation" htmlFor={`${type}-explanation`} required error={error}>
            <Input
              id={`${type}-explanation`}
              name={`${type}.explanation`}
              defaultValue={existing?.explanation ?? ""}
              required
            />
          </Field>
          <Field label="Supporting document (optional)">
            <DocumentUpload
              name={`${type}.documentId`}
              documentType="COMPLIANCE_SUPPORTING"
              value={supporting}
              onChange={setSupporting}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
