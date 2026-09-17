"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "../auth";
import { getApplicationBundle, primaryJurisdiction, toReadinessInput } from "../data/professional";
import { computeReadiness } from "../domain/readiness";
import { createClient } from "../supabase/server";
import { failure, success, type ActionState } from "./state";
import { formString } from "./helpers";

function revalidateAdmin(applicationId?: string) {
  revalidatePath("/admin/professionals");
  if (applicationId) revalidatePath(`/admin/professionals/${applicationId}`);
}

async function recordEvent(params: {
  applicationId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  subjectTable?: string;
  subjectId?: string;
  note?: string | null;
  actorId: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("application_review_events").insert({
    application_id: params.applicationId,
    event_type: params.eventType,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    subject_table: params.subjectTable ?? null,
    subject_id: params.subjectId ?? null,
    note: params.note ?? null,
    actor_id: params.actorId,
  });

  if (error) {
    console.error(`Could not record "${params.eventType}" in the audit trail:`, error);
  }
}

// ---------------------------------------------------------------------------
// Credential review
// ---------------------------------------------------------------------------

export async function reviewCredential(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const credentialId = formString(formData.get("credentialId"));
  const applicationId = formString(formData.get("applicationId"));
  const decision = formString(formData.get("decision"));
  const sourceUrl = formString(formData.get("verificationSourceUrl"));
  const note = formString(formData.get("adminNotes"));

  if (!credentialId || !applicationId || !decision) return failure("Missing input.");

  const statusByDecision: Record<string, string> = {
    verify: "VERIFIED",
    reject: "REJECTED",
    unable: "UNABLE_TO_VERIFY",
  };
  const status = statusByDecision[decision];
  if (!status) return failure("Unknown decision.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("credentials")
    .update({
      verification_status: status,
      verification_source_url: sourceUrl ?? null,
      verified_at: new Date().toISOString(),
      verified_by: admin.id,
      admin_notes: note ?? null,
    })
    .eq("id", credentialId);

  if (error) return failure(error.message);

  await recordEvent({
    applicationId,
    eventType:
      decision === "verify"
        ? "CREDENTIAL_VERIFIED"
        : decision === "reject"
          ? "CREDENTIAL_REJECTED"
          : "CREDENTIAL_UNABLE_TO_VERIFY",
    subjectTable: "credentials",
    subjectId: credentialId,
    note: note ?? sourceUrl ?? null,
    actorId: admin.id,
  });

  revalidateAdmin(applicationId);
  return success("Credential updated.");
}

export async function reviewInsurance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const policyId = formString(formData.get("policyId"));
  const applicationId = formString(formData.get("applicationId"));
  const decision = formString(formData.get("decision"));
  const note = formString(formData.get("adminNotes"));

  if (!policyId || !applicationId || !decision) return failure("Missing input.");

  const status = decision === "verify" ? "VERIFIED" : "REJECTED";
  const supabase = await createClient();
  const { error } = await supabase
    .from("insurance_policies")
    .update({
      status,
      verified_at: new Date().toISOString(),
      verified_by: admin.id,
      admin_notes: note ?? null,
    })
    .eq("id", policyId);

  if (error) return failure(error.message);

  await recordEvent({
    applicationId,
    eventType: "INSURANCE_REVIEWED",
    subjectTable: "insurance_policies",
    subjectId: policyId,
    note: `${status}${note ? `: ${note}` : ""}`,
    actorId: admin.id,
  });

  revalidateAdmin(applicationId);
  return success("Insurance updated.");
}

export async function resolveDisclosure(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const disclosureId = formString(formData.get("disclosureId"));
  const applicationId = formString(formData.get("applicationId"));
  const note = formString(formData.get("adminNotes"));
  if (!disclosureId || !applicationId) return failure("Missing input.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("compliance_disclosures")
    .update({
      resolved_by_admin: true,
      resolved_at: new Date().toISOString(),
      resolved_by: admin.id,
      admin_notes: note ?? null,
    })
    .eq("id", disclosureId);

  if (error) return failure(error.message);

  await recordEvent({
    applicationId,
    eventType: "NOTE_ADDED",
    subjectTable: "compliance_disclosures",
    subjectId: disclosureId,
    note: `Disclosure resolved${note ? `: ${note}` : ""}`,
    actorId: admin.id,
  });

  revalidateAdmin(applicationId);
  return success("Disclosure resolved.");
}

// ---------------------------------------------------------------------------
// Application decisions
// ---------------------------------------------------------------------------

export async function decideApplication(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const applicationId = formString(formData.get("applicationId"));
  const decision = formString(formData.get("decision"));
  const note = formString(formData.get("adminNotes"));
  if (!applicationId || !decision) return failure("Missing input.");

  const supabase = await createClient();
  const { data: application } = await supabase
    .from("professional_applications")
    .select("id, status, professional_id")
    .eq("id", applicationId)
    .maybeSingle();

  if (!application) return failure("Application not found.");

  const bundle = await getApplicationBundle(application.professional_id);
  if (!bundle) return failure("Application not found.");

  const nextStatus = {
    approve: "APPROVED",
    reject: "REJECTED",
    request_info: "NEEDS_INFORMATION",
    suspend: "SUSPENDED",
    credential_review: "CREDENTIAL_REVIEW",
    compliance_review: "COMPLIANCE_REVIEW",
  }[decision];

  if (!nextStatus) return failure("Unknown decision.");

  if (nextStatus === "APPROVED") {
    // Approval cannot bypass the readiness rules; the reviewer is one input, not
    // an override.
    const readiness = computeReadiness({
      ...toReadinessInput(bundle, primaryJurisdiction(bundle)),
      applicationStatus: "APPROVED",
    });

    if (!readiness.ready) {
      return failure(
        `Cannot approve yet: ${readiness.blockers.map((b) => b.message).join(" ")}`,
      );
    }
  }

  const { error } = await supabase
    .from("professional_applications")
    .update({
      status: nextStatus,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      admin_notes: note ?? null,
      independent_listing_eligible:
        nextStatus === "APPROVED"
          ? computeReadiness({
              ...toReadinessInput(bundle, primaryJurisdiction(bundle)),
              applicationStatus: "APPROVED",
            }).independentListingEligible
          : null,
    })
    .eq("id", applicationId);

  if (error) return failure(error.message);

  // Marketplace listing follows approval; suspension and rejection revoke it.
  const marketplaceStatus =
    nextStatus === "APPROVED"
      ? "ACTIVE"
      : nextStatus === "SUSPENDED"
        ? "SUSPENDED"
        : "INACTIVE";

  const { error: listingError } = await supabase
    .from("professional_profiles")
    .update({ marketplace_status: marketplaceStatus })
    .eq("id", application.professional_id);

  // A suspension that does not actually take the listing down, or an approval
  // that never puts it up, must not be reported to the reviewer as done.
  if (listingError) {
    return failure(
      `Application moved to ${nextStatus.replace(/_/g, " ").toLowerCase()}, but the marketplace listing could not be updated: ${listingError.message}`,
    );
  }

  await recordEvent({
    applicationId,
    eventType:
      nextStatus === "APPROVED"
        ? "APPROVED"
        : nextStatus === "REJECTED"
          ? "REJECTED"
          : nextStatus === "SUSPENDED"
            ? "SUSPENDED"
            : nextStatus === "NEEDS_INFORMATION"
              ? "INFORMATION_REQUESTED"
              : "STATUS_CHANGED",
    fromStatus: application.status,
    toStatus: nextStatus,
    note: note ?? null,
    actorId: admin.id,
  });

  revalidateAdmin(applicationId);

  // Approving, rejecting, suspending or handing the application back all end the
  // reviewer's work on it, so return them to the queue with the outcome. The two
  // stage moves keep them on the record they are still reading.
  const CLOSES_THE_REVIEW = ["approve", "reject", "suspend", "request_info"];
  if (CLOSES_THE_REVIEW.includes(decision)) {
    const name =
      bundle.profile.display_name ??
      `${bundle.profile.legal_first_name ?? ""} ${bundle.profile.legal_last_name ?? ""}`.trim();

    redirect(
      `/admin/professionals?decided=${nextStatus}&name=${encodeURIComponent(name || "The applicant")}`,
    );
  }

  return success(`Application moved to ${nextStatus.replace(/_/g, " ").toLowerCase()}.`);
}

export async function addAdminNote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const applicationId = formString(formData.get("applicationId"));
  const note = formString(formData.get("note"));
  if (!applicationId || !note) return failure("Write a note first.");

  await recordEvent({
    applicationId,
    eventType: "NOTE_ADDED",
    note,
    actorId: admin.id,
  });

  revalidateAdmin(applicationId);
  return success("Note added.");
}
