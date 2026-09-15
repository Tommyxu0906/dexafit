"use client";

import { useActionState, useEffect, useState } from "react";
import { DocumentUpload } from "@/components/document-upload";
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Field,
  Input,
  RequirementTag,
  SectionHeading,
  Select,
} from "@/components/ui";
import {
  deleteCredential,
  saveCredential,
  saveCredentialsStep,
} from "@/lib/actions/onboarding";
import { idleState } from "@/lib/actions/state";
import type { CredentialRow, DocumentRow, ProfessionalProfileRow } from "@/lib/data/types";
import { APRN_CATEGORIES, US_STATES } from "@/lib/domain/enums";
import { APRN_CATEGORY_LABELS, type CredentialRequirement, type ProfessionRequirements } from "@/lib/domain/requirements";

export function CredentialsStep({
  profile,
  jurisdiction,
  requirements,
  credentials,
  documents,
}: {
  profile: ProfessionalProfileRow;
  jurisdiction: string;
  requirements: ProfessionRequirements;
  credentials: CredentialRow[];
  documents: DocumentRow[];
}) {
  const [state, formAction, pending] = useActionState(saveCredentialsStep, idleState);
  const errors = state.fieldErrors ?? {};

  const optionalRequirements = requirements.credentials.filter((c) => !c.required);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Credentials"
        description="What we ask for depends on your profession. Documents are stored privately and are only visible to you and DexaFit's credentialing reviewers."
      />

      {requirements.restrictionNotice ? (
        <Callout tone="warning" title="Listing restriction">
          {requirements.restrictionNotice}
        </Callout>
      ) : null}

      {!requirements.jurisdictionResearched ? (
        <Callout tone="info" title="Manual review">
          DexaFit is launching in Massachusetts first. Applications from other states are
          reviewed individually.
        </Callout>
      ) : null}

      {state.message && !state.ok ? <Callout tone="danger">{state.message}</Callout> : null}

      {requirements.credentials
        .filter((r) => r.required)
        .map((requirement) => (
          <CredentialRequirementCard
            key={`${requirement.credentialType}-${requirement.label}`}
            requirement={requirement}
            jurisdiction={jurisdiction}
            credentials={credentials.filter(
              (c) => c.credential_type === requirement.credentialType,
            )}
            documents={documents}
            error={errors[`credential.${requirement.credentialType}`]}
          />
        ))}

      {optionalRequirements.length > 0 ? (
        <Card>
          <p className="mb-1 text-sm font-semibold text-ink">Optional credentials</p>
          <p className="mb-4 text-xs text-muted">
            Not required to list, but they strengthen your profile.
          </p>
          <div className="flex flex-col gap-4">
            {optionalRequirements.map((requirement) => (
              <CredentialRequirementCard
                key={`${requirement.credentialType}-${requirement.label}`}
                requirement={requirement}
                jurisdiction={jurisdiction}
                credentials={credentials.filter(
                  (c) => c.credential_type === requirement.credentialType,
                )}
                documents={documents}
                bare
              />
            ))}
          </div>
        </Card>
      ) : null}

      <form action={formAction} className="flex flex-col gap-6">
        <input type="hidden" name="jurisdictionState" value={jurisdiction} />

        {requirements.extraQuestions.includes("RD_RDN") ? (
          <Card>
            <Field
              label="Are you credentialed as an RD/RDN?"
              htmlFor="holdsRdRdn"
              required
              hint="A state Dietitian/Nutritionist license is a separate credential from RD/RDN registration with the CDR."
              error={errors.holdsRdRdn}
            >
              <Select
                id="holdsRdRdn"
                name="holdsRdRdn"
                defaultValue={
                  profile.holds_rd_rdn === null ? "" : String(profile.holds_rd_rdn)
                }
              >
                <option value="" disabled>
                  Select an answer
                </option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>
            </Field>
            <p className="mt-3 text-xs text-muted">
              If yes, add your CDR registration as a national certification above.
            </p>
          </Card>
        ) : null}

        {requirements.extraQuestions.includes("HSP") ? (
          <Card>
            <Field
              label="Are you Health Service Provider (HSP) certified?"
              htmlFor="hspCertified"
              required
              hint="A psychologist license and HSP certification are different credentials. Independently offering health services requires HSP."
              error={errors.hspCertified}
            >
              <Select
                id="hspCertified"
                name="hspCertified"
                defaultValue={
                  profile.hsp_certified === null ? "" : String(profile.hsp_certified)
                }
              >
                <option value="" disabled>
                  Select an answer
                </option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>
            </Field>
          </Card>
        ) : null}

        {requirements.extraQuestions.includes("APRN_CATEGORY") ? (
          <Card>
            <Field label="APRN category" htmlFor="aprnCategory" required error={errors.aprnCategory}>
              <Select
                id="aprnCategory"
                name="aprnCategory"
                defaultValue={profile.aprn_category ?? ""}
              >
                <option value="" disabled>
                  Select your category
                </option>
                {APRN_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {APRN_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>
        ) : null}

        {requirements.extraQuestions.includes("SUPERVISOR") ? (
          <Card>
            <p className="mb-4 text-sm font-semibold text-ink">Supervision</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Supervisor name" htmlFor="supervisorName" required error={errors.supervisorName}>
                <Input
                  id="supervisorName"
                  name="supervisorName"
                  defaultValue={profile.supervisor_name ?? ""}
                />
              </Field>
              <Field
                label="Supervisor license type"
                htmlFor="supervisorLicenseType"
                required
                error={errors.supervisorLicenseType}
              >
                <Input
                  id="supervisorLicenseType"
                  name="supervisorLicenseType"
                  placeholder="e.g. LICSW"
                  defaultValue={profile.supervisor_license_type ?? ""}
                />
              </Field>
              <Field
                label="Supervisor license number"
                htmlFor="supervisorLicenseNumber"
                required
                error={errors.supervisorLicenseNumber}
              >
                <Input
                  id="supervisorLicenseNumber"
                  name="supervisorLicenseNumber"
                  defaultValue={profile.supervisor_license_number ?? ""}
                />
              </Field>
              <Field
                label="Clinical / practice organization"
                htmlFor="supervisingOrganization"
                error={errors.supervisingOrganization}
              >
                <Input
                  id="supervisingOrganization"
                  name="supervisingOrganization"
                  defaultValue={profile.supervising_organization ?? ""}
                />
              </Field>
            </div>
          </Card>
        ) : null}

        {requirements.scopeAcknowledgement ? (
          <Card>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="scopeAcknowledged"
                value="true"
                className="mt-1 h-4 w-4 accent-emerald-600"
              />
              <span className="leading-relaxed text-ink">
                {requirements.scopeAcknowledgement}
              </span>
            </label>
            {errors.scopeAcknowledged ? (
              <p className="mt-2 text-xs font-medium text-rose-600">
                {errors.scopeAcknowledged}
              </p>
            ) : null}
          </Card>
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

function CredentialRequirementCard({
  requirement,
  jurisdiction,
  credentials,
  documents,
  error,
  bare,
}: {
  requirement: CredentialRequirement;
  jurisdiction: string;
  credentials: CredentialRow[];
  documents: DocumentRow[];
  error?: string;
  bare?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const body = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{requirement.label}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <RequirementTag legalRequirement={requirement.legalRequirement} />
            {requirement.required ? null : <Badge tone="neutral">Optional</Badge>}
          </div>
          {requirement.helpText ? (
            <p className="mt-2 text-xs text-muted">{requirement.helpText}</p>
          ) : null}
        </div>
        {!adding && !editing ? (
          <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
            Add
          </Button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-xs font-medium text-rose-600">{error}</p> : null}

      <div className="mt-4 flex flex-col gap-3">
        {credentials.length === 0 && !adding ? (
          <EmptyState>No {requirement.label.toLowerCase()} added yet.</EmptyState>
        ) : null}

        {credentials.map((credential) =>
          editing === credential.id ? (
            <CredentialForm
              key={credential.id}
              requirement={requirement}
              jurisdiction={jurisdiction}
              credential={credential}
              document={documents.find((d) => d.id === credential.document_id) ?? null}
              onDone={() => setEditing(null)}
            />
          ) : (
            <CredentialSummary
              key={credential.id}
              credential={credential}
              onEdit={() => setEditing(credential.id)}
            />
          ),
        )}

        {adding ? (
          <CredentialForm
            requirement={requirement}
            jurisdiction={jurisdiction}
            credential={null}
            document={null}
            onDone={() => setAdding(false)}
          />
        ) : null}
      </div>
    </>
  );

  if (bare) {
    return <div className="rounded-xl border border-line p-4">{body}</div>;
  }
  return <Card>{body}</Card>;
}

function CredentialSummary({
  credential,
  onEdit,
}: {
  credential: CredentialRow;
  onEdit: () => void;
}) {
  const [, deleteAction, deletePending] = useActionState(deleteCredential, idleState);

  const statusTone =
    credential.verification_status === "VERIFIED"
      ? "success"
      : credential.verification_status === "REJECTED"
        ? "danger"
        : credential.verification_status === "PENDING"
          ? "warning"
          : "neutral";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-slate-50 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{credential.credential_name}</p>
        <p className="mt-1 text-xs text-muted">
          {credential.credential_number ? `#${credential.credential_number} · ` : ""}
          {credential.jurisdiction_state ? `${credential.jurisdiction_state} · ` : ""}
          {credential.expiration_date
            ? `Expires ${credential.expiration_date}`
            : "No expiration on file"}
        </p>
        <div className="mt-2">
          <Badge tone={statusTone}>
            {credential.verification_status.replace(/_/g, " ").toLowerCase()}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={credential.id} />
          <Button type="submit" variant="danger" disabled={deletePending}>
            Remove
          </Button>
        </form>
      </div>
    </div>
  );
}

function CredentialForm({
  requirement,
  jurisdiction,
  credential,
  document,
  onDone,
}: {
  requirement: CredentialRequirement;
  jurisdiction: string;
  credential: CredentialRow | null;
  document: DocumentRow | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveCredential, idleState);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    // The server action revalidated; collapse back to the summary view.
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="rounded-xl border border-accent/40 bg-white p-4">
      <input type="hidden" name="credentialType" value={requirement.credentialType} />
      <input type="hidden" name="jurisdictionCountry" value="US" />
      {credential ? <input type="hidden" name="id" value={credential.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Credential name"
          htmlFor={`name-${credential?.id ?? "new"}`}
          required
          hint={
            requirement.exampleIssuers
              ? `Examples: ${requirement.exampleIssuers.join(", ")}`
              : undefined
          }
          error={errors.credentialName}
        >
          <Input
            id={`name-${credential?.id ?? "new"}`}
            name="credentialName"
            defaultValue={credential?.credential_name ?? requirement.label}
            required
          />
        </Field>

        <Field label="Issuing authority" htmlFor={`issuer-${credential?.id ?? "new"}`}>
          <Input
            id={`issuer-${credential?.id ?? "new"}`}
            name="issuingAuthority"
            defaultValue={credential?.issuing_authority ?? ""}
          />
        </Field>

        <Field
          label="Credential number"
          htmlFor={`number-${credential?.id ?? "new"}`}
          required={requirement.requiresNumber}
          error={errors.credentialNumber}
        >
          <Input
            id={`number-${credential?.id ?? "new"}`}
            name="credentialNumber"
            defaultValue={credential?.credential_number ?? ""}
            required={requirement.requiresNumber}
          />
        </Field>

        {requirement.requiresJurisdiction ? (
          <Field label="Issued in" htmlFor={`state-${credential?.id ?? "new"}`} required>
            <Select
              id={`state-${credential?.id ?? "new"}`}
              name="jurisdictionState"
              defaultValue={credential?.jurisdiction_state ?? jurisdiction}
            >
              {US_STATES.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="Issue date" htmlFor={`issued-${credential?.id ?? "new"}`}>
          <Input
            id={`issued-${credential?.id ?? "new"}`}
            name="issueDate"
            type="date"
            defaultValue={credential?.issue_date ?? ""}
          />
        </Field>

        <Field
          label="Expiration date"
          htmlFor={`expires-${credential?.id ?? "new"}`}
          required={requirement.requiresExpiration}
          error={errors.expirationDate}
        >
          <Input
            id={`expires-${credential?.id ?? "new"}`}
            name="expirationDate"
            type="date"
            defaultValue={credential?.expiration_date ?? ""}
            required={requirement.requiresExpiration}
          />
        </Field>
      </div>

      {requirement.requiresDocument ? (
        <div className="mt-4">
          <Field label="Documentation" required>
            <DocumentUpload
              name="documentId"
              documentType="CREDENTIAL"
              required
              existing={
                document
                  ? { id: document.id, original_filename: document.original_filename }
                  : null
              }
            />
          </Field>
        </div>
      ) : null}

      {state.message && !state.ok ? (
        <p className="mt-3 text-xs font-medium text-rose-600">{state.message}</p>
      ) : null}

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save credential"}
        </Button>
      </div>
    </form>
  );
}
