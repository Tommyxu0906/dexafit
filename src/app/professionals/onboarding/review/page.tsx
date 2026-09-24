import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Callout, Card, SectionHeading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  getApplicationBundle,
  getOrCreateProfessional,
  primaryJurisdiction,
  toReadinessInput,
} from "@/lib/data/professional";
import { CAPABILITY_LABELS, type CapabilityCode } from "@/lib/domain/capabilities";
import {
  DISCLOSURE_QUESTIONS,
  INSURANCE_TYPE_LABELS,
  PROFESSION_LABELS,
  SERVICE_MODE_LABELS,
} from "@/lib/domain/enums";
import { computePreApprovalReadiness } from "@/lib/domain/readiness";
import { SubmitApplication } from "./submit-application";

export default async function ReviewStep() {
  const user = await requireUser();
  const { profile } = await getOrCreateProfessional(user.id);
  const bundle = await getApplicationBundle(profile.id);

  if (!bundle) redirect("/professionals/onboarding/about");
  if (bundle.application.status !== "DRAFT") {
    redirect("/professionals/onboarding/status");
  }

  const jurisdiction = primaryJurisdiction(bundle);
  const readiness = computePreApprovalReadiness(toReadinessInput(bundle, jurisdiction));

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Review & submit"
        description="Check everything below, then submit for DexaFit credential review."
      />

      {!readiness.independentListingEligible && readiness.independentListingNotice ? (
        <Callout tone="warning" title="Listing restriction">
          {readiness.independentListingNotice}
        </Callout>
      ) : null}

      <ReviewSection title="About you" editHref="/professionals/onboarding/about">
        <Row label="Name" value={`${profile.legal_first_name} ${profile.legal_last_name}`} />
        <Row label="Display name" value={profile.display_name} />
        <Row
          label="Profession"
          value={
            profile.profession_types.length > 0
              ? profile.profession_types.map((t) => PROFESSION_LABELS[t]).join(", ")
              : null
          }
        />
        <Row label="Title" value={profile.professional_title} />
        <Row label="Experience" value={`${profile.years_experience ?? "—"} years`} />
        <Row label="Email" value={profile.email} />
        <Row label="Phone" value={profile.phone} />
        <Row label="Languages" value={profile.languages?.join(", ")} />
        <Row
          label="Profile photo"
          value={profile.profile_photo_document_id ? "Uploaded" : "Missing"}
        />
      </ReviewSection>

      <ReviewSection title="Practice" editHref="/professionals/onboarding/practice">
        <Row label="Joining as" value={profile.joining_as?.replace(/_/g, " ").toLowerCase()} />
        <Row label="Practice name" value={profile.practice_name} />
        <Row label="Business email" value={profile.business_email} />
        <Row label="Business phone" value={profile.business_phone} />
        {/* The practice address is the only address now that the separate
            location step is gone, so the applicant should see it here before
            submitting rather than discover it was never captured. */}
        <Row
          label="Practice address"
          value={
            bundle.locations[0]
              ? [
                  bundle.locations[0].address_1,
                  bundle.locations[0].city,
                  bundle.locations[0].state,
                  bundle.locations[0].postal_code,
                ]
                  .filter(Boolean)
                  .join(", ")
              : null
          }
        />
        <Row
          label="Service modes"
          value={profile.service_modes?.map((m) => SERVICE_MODE_LABELS[m]).join(", ")}
        />
        <Row
          label="Accepting new clients"
          value={profile.accepting_new_clients ? "Yes" : "No"}
        />
      </ReviewSection>

      <ReviewSection title="Credentials" editHref="/professionals/onboarding/credentials">
        {bundle.credentials.length === 0 ? (
          <p className="text-sm text-muted">No credentials added.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {bundle.credentials.map((credential) => (
              <li key={credential.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-ink">{credential.credential_name}</span>
                <span className="text-muted">
                  {credential.credential_number ? `#${credential.credential_number}` : ""}
                  {credential.jurisdiction_state ? ` · ${credential.jurisdiction_state}` : ""}
                  {credential.expiration_date ? ` · exp ${credential.expiration_date}` : ""}
                </span>
                <Badge tone={credential.document_id ? "success" : "warning"}>
                  {credential.document_id ? "Document attached" : "No document"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {profile.hsp_certified !== null ? (
          <Row label="HSP certified" value={profile.hsp_certified ? "Yes" : "No"} />
        ) : null}
        {profile.holds_rd_rdn !== null ? (
          <Row label="RD/RDN credentialed" value={profile.holds_rd_rdn ? "Yes" : "No"} />
        ) : null}
        {profile.aprn_category ? (
          <Row label="APRN category" value={profile.aprn_category} />
        ) : null}
        {profile.supervisor_name ? (
          <Row
            label="Supervisor"
            value={`${profile.supervisor_name} (${profile.supervisor_license_type ?? "—"} #${profile.supervisor_license_number ?? "—"})`}
          />
        ) : null}
      </ReviewSection>

      <ReviewSection
        title="Insurance & compliance"
        editHref="/professionals/onboarding/insurance"
      >
        {bundle.insurancePolicies.length === 0 ? (
          <p className="text-sm text-muted">No insurance on file.</p>
        ) : (
          bundle.insurancePolicies.map((policy) => (
            <Row
              key={policy.id}
              label={INSURANCE_TYPE_LABELS[policy.insurance_type]}
              value={`${policy.carrier_name} · #${policy.policy_number} · exp ${policy.expiration_date ?? "—"}`}
            />
          ))
        )}
        {bundle.disclosures.map((disclosure) => (
          <Row
            key={disclosure.id}
            label={DISCLOSURE_QUESTIONS[disclosure.disclosure_type].slice(0, 60) + "…"}
            value={disclosure.answer ? `Yes — ${disclosure.explanation ?? ""}` : "No"}
          />
        ))}
      </ReviewSection>

      <ReviewSection title="Who you help" editHref="/professionals/onboarding/who-you-help">
        <div className="flex flex-wrap gap-2">
          {bundle.capabilities.map((capability) => (
            <Badge key={capability.id}>
              {CAPABILITY_LABELS[capability.capability_code as CapabilityCode] ??
                capability.capability_code}
            </Badge>
          ))}
        </div>
      </ReviewSection>

      {/* Products are not reviewed here. They are not a credentialing question,
          they are added on the provider's own page after approval, and listing
          them in the application implied they had to be filled in first.
          Practice location is shown under Practice, where it is now asked. */}

      <ReviewSection title="Attestations" editHref="/professionals/onboarding/attestations">
        <Row
          label="Accepted"
          value={`${bundle.attestations.filter((a) => a.accepted).length} of 8`}
        />
        <Row label="Signature" value={bundle.application.electronic_signature} />
        <Row label="Signed" value={bundle.application.signature_date} />
      </ReviewSection>

      <SubmitApplication />
    </div>
  );
}

function ReviewSection({
  title,
  editHref,
  children,
}: {
  title: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        <Link
          href={editHref}
          className="text-sm font-semibold text-emerald-700 underline underline-offset-2"
        >
          Edit
        </Link>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
      <span className="min-w-44 text-muted">{label}</span>
      <span className="font-medium text-ink">{value || "—"}</span>
    </div>
  );
}
