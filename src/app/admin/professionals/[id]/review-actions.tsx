"use client";

import { useActionState } from "react";
import { Button, Callout, Input, Select } from "@/components/ui";
import {
  addAdminNote,
  decideApplication,
  resolveDisclosure,
  reviewCredential,
  reviewInsurance,
} from "@/lib/actions/admin";
import { idleState } from "@/lib/actions/state";

export function CredentialReview({
  credentialId,
  applicationId,
}: {
  credentialId: string;
  applicationId: string;
}) {
  const [state, formAction, pending] = useActionState(reviewCredential, idleState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3">
      <input type="hidden" name="credentialId" value={credentialId} />
      <input type="hidden" name="applicationId" value={applicationId} />

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          name="verificationSourceUrl"
          type="url"
          placeholder="Verification source URL"
        />
        <Input name="adminNotes" placeholder="Internal note" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="verify" disabled={pending}>
          Verify
        </Button>
        <Button
          type="submit"
          name="decision"
          value="unable"
          variant="secondary"
          disabled={pending}
        >
          Unable to verify
        </Button>
        <Button
          type="submit"
          name="decision"
          value="reject"
          variant="danger"
          disabled={pending}
        >
          Reject
        </Button>
      </div>

      {state.message ? (
        <p
          className={`text-xs font-medium ${state.ok ? "text-emerald-700" : "text-rose-600"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function InsuranceReview({
  policyId,
  applicationId,
}: {
  policyId: string;
  applicationId: string;
}) {
  const [state, formAction, pending] = useActionState(reviewInsurance, idleState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3">
      <input type="hidden" name="policyId" value={policyId} />
      <input type="hidden" name="applicationId" value={applicationId} />
      <Input name="adminNotes" placeholder="Internal note" />
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="verify" disabled={pending}>
          Verify
        </Button>
        <Button
          type="submit"
          name="decision"
          value="reject"
          variant="danger"
          disabled={pending}
        >
          Reject
        </Button>
      </div>
      {state.message ? (
        <p
          className={`text-xs font-medium ${state.ok ? "text-emerald-700" : "text-rose-600"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function DisclosureResolution({
  disclosureId,
  applicationId,
}: {
  disclosureId: string;
  applicationId: string;
}) {
  const [state, formAction, pending] = useActionState(resolveDisclosure, idleState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="disclosureId" value={disclosureId} />
      <input type="hidden" name="applicationId" value={applicationId} />
      <Input name="adminNotes" placeholder="How was this resolved?" />
      <Button type="submit" variant="secondary" disabled={pending}>
        Mark resolved
      </Button>
      {state.message && !state.ok ? (
        <p className="text-xs font-medium text-rose-600">{state.message}</p>
      ) : null}
    </form>
  );
}

export function ApplicationDecision({
  applicationId,
  currentStatus,
  readyToApprove,
}: {
  applicationId: string;
  currentStatus: string;
  readyToApprove: boolean;
}) {
  const [state, formAction, pending] = useActionState(decideApplication, idleState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="applicationId" value={applicationId} />

      <Select name="stage" defaultValue={currentStatus} disabled>
        <option value={currentStatus}>
          Current: {currentStatus.replace(/_/g, " ").toLowerCase()}
        </option>
      </Select>

      <Input name="adminNotes" placeholder="Note to the applicant (optional)" />

      <div className="flex flex-col gap-2">
        <Button type="submit" name="decision" value="credential_review" variant="secondary" disabled={pending}>
          Move to credential review
        </Button>
        <Button type="submit" name="decision" value="compliance_review" variant="secondary" disabled={pending}>
          Move to compliance review
        </Button>
        <Button type="submit" name="decision" value="request_info" variant="secondary" disabled={pending}>
          Request more information
        </Button>
        <Button type="submit" name="decision" value="approve" disabled={pending || !readyToApprove}>
          Approve
        </Button>
        <Button type="submit" name="decision" value="suspend" variant="danger" disabled={pending}>
          Suspend
        </Button>
        <Button type="submit" name="decision" value="reject" variant="danger" disabled={pending}>
          Reject
        </Button>
      </div>

      {!readyToApprove ? (
        <p className="text-xs text-muted">
          Approval unlocks once every credentialing rule passes.
        </p>
      ) : null}

      {state.message ? (
        <Callout tone={state.ok ? "success" : "danger"}>{state.message}</Callout>
      ) : null}
    </form>
  );
}

export function NoteForm({ applicationId }: { applicationId: string }) {
  const [state, formAction, pending] = useActionState(addAdminNote, idleState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <Input name="note" placeholder="Internal note" />
      <Button type="submit" variant="secondary" disabled={pending}>
        Add note
      </Button>
      {state.message ? (
        <p
          className={`text-xs font-medium ${state.ok ? "text-emerald-700" : "text-rose-600"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
