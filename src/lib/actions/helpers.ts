import { requireUser } from "../auth";
import { getOrCreateProfessional } from "../data/professional";
import type { ApplicationRow, ProfessionalProfileRow } from "../data/types";
import { captureServerError } from "../observability";
import { createClient } from "../supabase/server";

export type OnboardingContext = {
  professionalId: string;
  profile: ProfessionalProfileRow;
  application: ApplicationRow;
};

/** Every write starts here, so professional_id always comes from the session. */
export async function getOnboardingContext(): Promise<OnboardingContext> {
  const user = await requireUser();
  const { profile, application } = await getOrCreateProfessional(user.id);
  return { professionalId: profile.id, profile, application };
}

export async function markStepComplete(
  application: ApplicationRow,
  step: string,
): Promise<void> {
  if (application.completed_steps.includes(step)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("professional_applications")
    .update({ completed_steps: [...application.completed_steps, step] })
    .eq("id", application.id);

  if (error) {
    captureServerError(error, {
      operation: "onboarding.markStepComplete",
      applicationId: application.id,
      detail: step,
    });
  }
}

const POST_SUBMISSION_STATUSES = [
  "SUBMITTED",
  "CREDENTIAL_REVIEW",
  "COMPLIANCE_REVIEW",
  "NEEDS_INFORMATION",
  "APPROVED",
] as const;

/**
 * An edit after submission cannot silently keep a prior approval. The affected
 * application drops back into credential review and the change is recorded.
 */
export async function reopenForReview(
  application: ApplicationRow,
  note: string,
  subject?: { table: string; id: string },
): Promise<void> {
  if (!(POST_SUBMISSION_STATUSES as readonly string[]).includes(application.status)) {
    return;
  }

  const supabase = await createClient();

  if (application.status === "APPROVED" || application.status === "NEEDS_INFORMATION") {
    const { error: statusError } = await supabase
      .from("professional_applications")
      .update({ status: "CREDENTIAL_REVIEW" })
      .eq("id", application.id);

    // These two carry the guarantee that an approved listing cannot survive an
    // unreviewed change. Failing them quietly would leave a professional on the
    // marketplace on the strength of a credential they just replaced, so they
    // throw rather than let the caller report success.
    if (statusError) {
      throw new Error(`Could not reopen the application for review: ${statusError.message}`);
    }

    const { error: listingError } = await supabase
      .from("professional_profiles")
      .update({ marketplace_status: "INACTIVE" })
      .eq("id", application.professional_id);

    if (listingError) {
      throw new Error(
        `Could not stand the marketplace listing down: ${listingError.message}`,
      );
    }
  }

  const { error: auditError } = await supabase
    .from("application_review_events")
    .insert({
      application_id: application.id,
      event_type: "REOPENED_FOR_REVIEW",
      from_status: application.status,
      to_status:
        application.status === "APPROVED" || application.status === "NEEDS_INFORMATION"
          ? "CREDENTIAL_REVIEW"
          : application.status,
      subject_table: subject?.table ?? null,
      subject_id: subject?.id ?? null,
      note,
    });

  if (auditError) {
    captureServerError(auditError, {
      operation: "onboarding.reopenForReview.audit",
      applicationId: application.id,
    });
  }
}

/**
 * A verified credential that the provider edits must lose its verified state;
 * otherwise a swapped license number would inherit an old approval.
 */
export async function resetCredentialVerification(credentialId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("credentials")
    .update({
      verification_status: "PENDING",
      verified_at: null,
      verified_by: null,
    })
    .eq("id", credentialId)
    .eq("verification_status", "VERIFIED");

  // The database trigger enforces this too, but if the write fails here we must
  // not report a successful edit of a credential that still reads as verified.
  if (error) {
    throw new Error(`Could not reset credential verification: ${error.message}`);
  }
}

export function formBoolean(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "on" || value === "1";
}

export function formString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
