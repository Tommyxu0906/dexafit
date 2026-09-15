import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Callout, Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import {
  getApplicationBundle,
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
import { getRequirements } from "@/lib/domain/requirements";
import { createClient } from "@/lib/supabase/server";
import type { ReviewEventRow } from "@/lib/data/types";
import { DocumentLink } from "./document-link";
import {
  ApplicationDecision,
  CredentialReview,
  DisclosureResolution,
  InsuranceReview,
  NoteForm,
} from "./review-actions";

export default async function AdminProfessionalDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: application } = await supabase
    .from("professional_applications")
    .select("professional_id")
    .eq("id", id)
    .maybeSingle();

  if (!application) notFound();

  const bundle = await getApplicationBundle(application.professional_id);
  if (!bundle) notFound();

  const { profile } = bundle;
  const jurisdiction = primaryJurisdiction(bundle);
  const readiness = computePreApprovalReadiness(toReadinessInput(bundle, jurisdiction));
  const requirements = profile.profession_type
    ? getRequirements(profile.profession_type, jurisdiction)
    : null;

  const { data: events } = await supabase
    .from("application_review_events")
    .select("*")
    .eq("application_id", id)
    .order("created_at", { ascending: false });

  const documentsById = new Map(bundle.documents.map((d) => [d.id, d]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/professionals"
          className="text-sm text-muted underline-offset-2 hover:underline"
        >
          ← All professionals
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              {profile.display_name ??
                `${profile.legal_first_name ?? ""} ${profile.legal_last_name ?? ""}`}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {profile.profession_type
                ? PROFESSION_LABELS[profile.profession_type]
                : "No profession selected"}
              {profile.professional_title ? ` · ${profile.professional_title}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">
              {bundle.application.status.replace(/_/g, " ").toLowerCase()}
            </Badge>
            <Badge tone={profile.marketplace_status === "ACTIVE" ? "success" : "neutral"}>
              marketplace {profile.marketplace_status.toLowerCase()}
            </Badge>
          </div>
        </div>
      </div>

      {readiness.ready ? (
        <Callout tone="success" title="Ready to approve">
          Every credentialing rule passes for this application.
        </Callout>
      ) : (
        <Callout tone="warning" title="Not ready to approve">
          <ul className="mt-1 flex flex-col gap-1">
            {readiness.blockers
              .filter((b) => b.code !== "NOT_ADMIN_APPROVED")
              .map((blocker) => (
                <li key={blocker.code + blocker.message}>· {blocker.message}</li>
              ))}
          </ul>
        </Callout>
      )}

      {!readiness.independentListingEligible && readiness.independentListingNotice ? (
        <Callout tone="danger" title="Independent listing not permitted">
          {readiness.independentListingNotice}
        </Callout>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <h2 className="mb-4 text-sm font-bold text-ink">Profile</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail label="Legal name" value={`${profile.legal_first_name ?? ""} ${profile.legal_last_name ?? ""}`} />
              <Detail label="Email" value={profile.email} />
              <Detail label="Phone" value={profile.phone} />
              <Detail label="Experience" value={`${profile.years_experience ?? "—"} years`} />
              <Detail label="Languages" value={profile.languages?.join(", ")} />
              <Detail label="Practice" value={profile.practice_name} />
              <Detail
                label="Joining as"
                value={profile.joining_as?.replace(/_/g, " ").toLowerCase()}
              />
              <Detail
                label="Accepting clients"
                value={profile.accepting_new_clients ? "Yes" : "No"}
              />
              {profile.hsp_certified !== null ? (
                <Detail label="HSP certified" value={profile.hsp_certified ? "Yes" : "No"} />
              ) : null}
              {profile.holds_rd_rdn !== null ? (
                <Detail label="RD/RDN" value={profile.holds_rd_rdn ? "Yes" : "No"} />
              ) : null}
              {profile.aprn_category ? (
                <Detail label="APRN category" value={profile.aprn_category} />
              ) : null}
              {profile.supervisor_name ? (
                <Detail
                  label="Supervisor"
                  value={`${profile.supervisor_name} · ${profile.supervisor_license_type ?? ""} #${profile.supervisor_license_number ?? ""}`}
                />
              ) : null}
            </dl>
            {profile.bio ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                {profile.bio}
              </p>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-1 text-sm font-bold text-ink">Credentials</h2>
            {requirements ? (
              <p className="mb-4 text-xs text-muted">
                Required for {PROFESSION_LABELS[profile.profession_type!]} in {jurisdiction}
                :{" "}
                {requirements.credentials
                  .filter((c) => c.required)
                  .map((c) => `${c.label} (${c.legalRequirement ? "licensure" : "DexaFit policy"})`)
                  .join(", ")}
              </p>
            ) : null}

            <div className="flex flex-col gap-4">
              {bundle.credentials.map((credential) => (
                <div key={credential.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {credential.credential_name}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {credential.credential_type.replace(/_/g, " ").toLowerCase()}
                        {credential.credential_number ? ` · #${credential.credential_number}` : ""}
                        {credential.jurisdiction_state ? ` · ${credential.jurisdiction_state}` : ""}
                        {credential.expiration_date ? ` · expires ${credential.expiration_date}` : ""}
                      </p>
                      {credential.issuing_authority ? (
                        <p className="mt-1 text-xs text-muted">
                          Issued by {credential.issuing_authority}
                        </p>
                      ) : null}
                    </div>
                    <Badge
                      tone={
                        credential.verification_status === "VERIFIED"
                          ? "success"
                          : credential.verification_status === "REJECTED"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {credential.verification_status.replace(/_/g, " ").toLowerCase()}
                    </Badge>
                  </div>

                  {credential.document_id ? (
                    <div className="mt-3">
                      <DocumentLink
                        documentId={credential.document_id}
                        filename={
                          documentsById.get(credential.document_id)?.original_filename ??
                          "View document"
                        }
                      />
                    </div>
                  ) : (
                    <p className="mt-3 text-xs font-medium text-amber-700">
                      No document uploaded.
                    </p>
                  )}

                  {credential.verification_source_url ? (
                    <p className="mt-2 text-xs text-muted">
                      Source: {credential.verification_source_url}
                    </p>
                  ) : null}
                  {credential.admin_notes ? (
                    <p className="mt-2 text-xs text-muted">Note: {credential.admin_notes}</p>
                  ) : null}

                  <div className="mt-4">
                    <CredentialReview credentialId={credential.id} applicationId={id} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-bold text-ink">Insurance</h2>
            <div className="flex flex-col gap-4">
              {bundle.insurancePolicies.length === 0 ? (
                <p className="text-sm text-muted">No policies on file.</p>
              ) : (
                bundle.insurancePolicies.map((policy) => (
                  <div key={policy.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {INSURANCE_TYPE_LABELS[policy.insurance_type]} · {policy.carrier_name}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          #{policy.policy_number} · {policy.effective_date} →{" "}
                          {policy.expiration_date}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {policy.coverage_per_claim
                            ? `$${Number(policy.coverage_per_claim).toLocaleString()} per claim`
                            : "Per-claim not stated"}
                          {policy.coverage_aggregate
                            ? ` · $${Number(policy.coverage_aggregate).toLocaleString()} aggregate`
                            : ""}
                        </p>
                      </div>
                      <Badge tone={policy.status === "VERIFIED" ? "success" : "neutral"}>
                        {policy.status.toLowerCase()}
                      </Badge>
                    </div>

                    {policy.certificate_document_id ? (
                      <div className="mt-3">
                        <DocumentLink
                          documentId={policy.certificate_document_id}
                          filename={
                            documentsById.get(policy.certificate_document_id)
                              ?.original_filename ?? "Certificate of insurance"
                          }
                        />
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <InsuranceReview policyId={policy.id} applicationId={id} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-bold text-ink">Compliance</h2>
            <div className="flex flex-col gap-4">
              {bundle.disclosures.map((disclosure) => (
                <div
                  key={disclosure.id}
                  className={`rounded-xl border p-4 ${
                    disclosure.answer && !disclosure.resolved_by_admin
                      ? "border-amber-300 bg-amber-50"
                      : "border-line"
                  }`}
                >
                  <p className="text-sm text-ink">
                    {DISCLOSURE_QUESTIONS[disclosure.disclosure_type]}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {disclosure.answer ? "Yes" : "No"}
                  </p>
                  {disclosure.explanation ? (
                    <p className="mt-1 text-sm text-muted">{disclosure.explanation}</p>
                  ) : null}
                  {disclosure.supporting_document_id ? (
                    <div className="mt-3">
                      <DocumentLink
                        documentId={disclosure.supporting_document_id}
                        filename={
                          documentsById.get(disclosure.supporting_document_id)
                            ?.original_filename ?? "Supporting document"
                        }
                      />
                    </div>
                  ) : null}
                  {disclosure.answer && !disclosure.resolved_by_admin ? (
                    <div className="mt-4">
                      <DisclosureResolution
                        disclosureId={disclosure.id}
                        applicationId={id}
                      />
                    </div>
                  ) : disclosure.answer ? (
                    <p className="mt-3 text-xs font-medium text-emerald-700">
                      Resolved{disclosure.admin_notes ? `: ${disclosure.admin_notes}` : ""}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-bold text-ink">Capabilities</h2>
            <div className="flex flex-wrap gap-2">
              {bundle.capabilities.map((capability) => (
                <Badge key={capability.id}>
                  {CAPABILITY_LABELS[capability.capability_code as CapabilityCode] ??
                    capability.capability_code}
                </Badge>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-bold text-ink">Services & locations</h2>
            <div className="flex flex-col gap-3">
              {bundle.services.map((service) => (
                <div key={service.id} className="rounded-xl border border-line p-3">
                  <p className="text-sm font-semibold text-ink">{service.service_name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {SERVICE_MODE_LABELS[service.modality]} · {service.duration_minutes} min
                    {service.price_amount != null ? ` · $${service.price_amount}` : ""}
                    {service.booking_url ? ` · ${service.booking_url}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{service.service_description}</p>
                </div>
              ))}
              {bundle.locations.map((location) => (
                <p key={location.id} className="text-sm text-muted">
                  {[location.address_1, location.city, location.state, location.postal_code]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  · {SERVICE_MODE_LABELS[location.service_mode]}
                </p>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 text-sm font-bold text-ink">Decision</h2>
            <ApplicationDecision
              applicationId={id}
              currentStatus={bundle.application.status}
              readyToApprove={readiness.ready}
            />
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-bold text-ink">Internal note</h2>
            <NoteForm applicationId={id} />
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-bold text-ink">Review history</h2>
            <ul className="flex flex-col gap-3">
              {((events ?? []) as ReviewEventRow[]).map((event) => (
                <li key={event.id} className="border-l-2 border-line pl-3 text-sm">
                  <p className="font-medium text-ink">
                    {event.event_type.replace(/_/g, " ").toLowerCase()}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                  {event.note ? (
                    <p className="mt-1 text-xs text-slate-600">{event.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{value || "—"}</dd>
    </div>
  );
}
