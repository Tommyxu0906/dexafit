"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AGREEMENT_VERSION, ATTESTATION_TYPES } from "../domain/attestations";
import { filterAllowedCapabilities } from "../domain/capabilities";
import { DISCLOSURE_TYPES } from "../domain/enums";
import { getRequirements } from "../domain/requirements";
import {
  aboutYouSchema,
  attestationsSchema,
  capabilitiesSchema,
  credentialExtrasSchema,
  credentialSchema,
  disclosuresSchema,
  insuranceSchema,
  practiceSchema,
  serviceLocationSchema,
  serviceOfferingSchema,
} from "../domain/schemas";
import { getApplicationBundle, primaryJurisdiction } from "../data/professional";
import { createClient } from "../supabase/server";
import {
  formBoolean,
  formString,
  getOnboardingContext,
  markStepComplete,
  reopenForReview,
  resetCredentialVerification,
} from "./helpers";
import { failure, success, toFieldErrors, type ActionState } from "./state";

const ONBOARDING_BASE = "/professionals/onboarding";

function revalidateOnboarding() {
  revalidatePath(ONBOARDING_BASE, "layout");
}

// ---------------------------------------------------------------------------
// Step 1 — About you
// ---------------------------------------------------------------------------

export async function saveAboutYou(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { professionalId, application } = await getOnboardingContext();

  const parsed = aboutYouSchema.safeParse({
    legalFirstName: formData.get("legalFirstName"),
    legalLastName: formData.get("legalLastName"),
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    professionalTitle: formData.get("professionalTitle"),
    professionType: formData.get("professionType"),
    yearsExperience: formData.get("yearsExperience"),
    bio: formData.get("bio"),
    languages: formData.getAll("languages"),
    websiteUrl: formData.get("websiteUrl"),
    linkedinUrl: formData.get("linkedinUrl"),
    instagramUrl: formData.get("instagramUrl"),
  });

  if (!parsed.success) {
    return failure("Please fix the highlighted fields.", toFieldErrors(parsed.error));
  }

  const photoDocumentId = formString(formData.get("profilePhotoDocumentId"));
  const value = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("professional_profiles")
    .update({
      legal_first_name: value.legalFirstName,
      legal_last_name: value.legalLastName,
      display_name: value.displayName,
      email: value.email,
      phone: value.phone,
      professional_title: value.professionalTitle,
      profession_type: value.professionType,
      years_experience: value.yearsExperience,
      bio: value.bio,
      languages: value.languages,
      website_url: value.websiteUrl ?? null,
      linkedin_url: value.linkedinUrl ?? null,
      instagram_url: value.instagramUrl ?? null,
      ...(photoDocumentId ? { profile_photo_document_id: photoDocumentId } : {}),
    })
    .eq("id", professionalId);

  if (error) return failure(error.message);

  await markStepComplete(application, "about");
  await reopenForReview(application, "Profile details edited after submission.");
  revalidateOnboarding();
  redirect(`${ONBOARDING_BASE}/practice`);
}

// ---------------------------------------------------------------------------
// Step 2 — Practice
// ---------------------------------------------------------------------------

export async function savePractice(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { professionalId, profile, application } = await getOnboardingContext();

  const parsed = practiceSchema.safeParse({
    joiningAs: formData.get("joiningAs"),
    practiceName: formData.get("practiceName"),
    organizationLegalName: formData.get("organizationLegalName"),
    organizationDba: formData.get("organizationDba"),
    businessEmail: formData.get("businessEmail"),
    businessPhone: formData.get("businessPhone"),
    businessWebsite: formData.get("businessWebsite"),
    businessAddress1: formData.get("businessAddress1"),
    businessAddress2: formData.get("businessAddress2"),
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
    country: formData.get("country"),
    serviceModes: formData.getAll("serviceModes"),
    acceptingNewClients: formBoolean(formData.get("acceptingNewClients")),
  });

  if (!parsed.success) {
    return failure("Please fix the highlighted fields.", toFieldErrors(parsed.error));
  }

  const value = parsed.data;
  const supabase = await createClient();
  let organizationId = profile.organization_id;

  if (value.joiningAs !== "INDIVIDUAL" && value.organizationLegalName) {
    const payload = {
      legal_name: value.organizationLegalName,
      dba: value.organizationDba ?? null,
      business_email: value.businessEmail,
      business_phone: value.businessPhone,
      business_website: value.businessWebsite ?? null,
      address_1: value.businessAddress1 ?? null,
      address_2: value.businessAddress2 ?? null,
      city: value.city ?? null,
      state: value.state ?? null,
      postal_code: value.postalCode ?? null,
      country: value.country,
    };

    if (organizationId) {
      await supabase.from("organizations").update(payload).eq("id", organizationId);
    } else {
      const { data, error } = await supabase
        .from("organizations")
        .insert(payload)
        .select("id")
        .single();
      if (error) return failure(error.message);
      organizationId = data.id;

      await supabase.from("professional_organization_memberships").insert({
        professional_id: professionalId,
        organization_id: organizationId,
        role: value.joiningAs === "ORGANIZATION_OWNER" ? "OWNER" : "MEMBER",
      });
    }
  }

  const { error } = await supabase
    .from("professional_profiles")
    .update({
      joining_as: value.joiningAs,
      practice_name: value.practiceName ?? null,
      organization_id: value.joiningAs === "INDIVIDUAL" ? null : organizationId,
      business_email: value.businessEmail,
      business_phone: value.businessPhone,
      business_website: value.businessWebsite ?? null,
      service_modes: value.serviceModes,
      accepting_new_clients: value.acceptingNewClients,
    })
    .eq("id", professionalId);

  if (error) return failure(error.message);

  await markStepComplete(application, "practice");
  revalidateOnboarding();
  redirect(`${ONBOARDING_BASE}/credentials`);
}

// ---------------------------------------------------------------------------
// Step 3 — Credentials
// ---------------------------------------------------------------------------

export async function saveCredential(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { professionalId, profile, application } = await getOnboardingContext();

  const parsed = credentialSchema.safeParse({
    id: formString(formData.get("id")),
    credentialType: formData.get("credentialType"),
    credentialName: formData.get("credentialName"),
    credentialNumber: formData.get("credentialNumber"),
    issuingAuthority: formData.get("issuingAuthority"),
    jurisdictionCountry: formData.get("jurisdictionCountry") ?? "US",
    jurisdictionState: formData.get("jurisdictionState"),
    issueDate: formData.get("issueDate"),
    expirationDate: formData.get("expirationDate"),
    documentId: formString(formData.get("documentId")),
  });

  if (!parsed.success) {
    return failure("Please fix the highlighted fields.", toFieldErrors(parsed.error));
  }

  const value = parsed.data;

  // Refuse to store a credential that is missing documentation it requires.
  // Saving it anyway strands the uploaded file with nothing pointing at it and
  // hides the problem until the final submit.
  if (profile.profession_type) {
    const requirement = getRequirements(
      profile.profession_type,
      formString(formData.get("jurisdictionState")) ?? value.jurisdictionState ?? "MA",
    ).credentials.find((c) => c.credentialType === value.credentialType);

    if (requirement?.requiresDocument && !value.documentId) {
      return failure(
        "Attach the supporting document before saving this credential.",
        { documentId: "Upload a file" },
      );
    }
  }

  const supabase = await createClient();

  const payload = {
    professional_id: professionalId,
    credential_type: value.credentialType,
    credential_name: value.credentialName,
    credential_number: value.credentialNumber ?? null,
    issuing_authority: value.issuingAuthority ?? null,
    jurisdiction_country: value.jurisdictionCountry,
    jurisdiction_state: value.jurisdictionState ?? null,
    issue_date: value.issueDate ?? null,
    expiration_date: value.expirationDate ?? null,
    ...(value.documentId ? { document_id: value.documentId } : {}),
  };

  if (value.id) {
    // Scoped by professional_id as well as id: never trust a client-supplied id alone.
    const { error } = await supabase
      .from("credentials")
      .update(payload)
      .eq("id", value.id)
      .eq("professional_id", professionalId);
    if (error) return failure(error.message);

    await resetCredentialVerification(value.id);
    await reopenForReview(application, `Credential updated: ${value.credentialName}.`, {
      table: "credentials",
      id: value.id,
    });
  } else {
    const { error } = await supabase.from("credentials").insert(payload);
    if (error) return failure(error.message);
    await reopenForReview(application, `Credential added: ${value.credentialName}.`);
  }

  revalidateOnboarding();
  return success("Credential saved.");
}

export async function deleteCredential(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { professionalId, application } = await getOnboardingContext();
  const id = formString(formData.get("id"));
  if (!id) return failure("Missing credential.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("credentials")
    .delete()
    .eq("id", id)
    .eq("professional_id", professionalId);

  if (error) return failure(error.message);

  await reopenForReview(application, "Credential removed.");
  revalidateOnboarding();
  return success("Credential removed.");
}

export async function saveCredentialsStep(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { professionalId, profile, application } = await getOnboardingContext();

  const parsed = credentialExtrasSchema.safeParse({
    holdsRdRdn: formData.has("holdsRdRdn") ? formBoolean(formData.get("holdsRdRdn")) : undefined,
    hspCertified: formData.has("hspCertified")
      ? formBoolean(formData.get("hspCertified"))
      : undefined,
    aprnCategory: formString(formData.get("aprnCategory")),
    supervisorName: formData.get("supervisorName"),
    supervisorLicenseType: formData.get("supervisorLicenseType"),
    supervisorLicenseNumber: formData.get("supervisorLicenseNumber"),
    supervisingOrganization: formData.get("supervisingOrganization"),
    scopeAcknowledged: formBoolean(formData.get("scopeAcknowledged")),
  });

  if (!parsed.success) {
    return failure("Please fix the highlighted fields.", toFieldErrors(parsed.error));
  }

  const value = parsed.data;
  const professionType = profile.profession_type;
  if (!professionType) return failure("Select your profession in step 1 first.");

  const jurisdiction = formString(formData.get("jurisdictionState")) ?? "MA";
  const requirements = getRequirements(professionType, jurisdiction);

  // Server-side enforcement of the profession-specific questions; the client
  // form can be bypassed.
  const fieldErrors: Record<string, string> = {};

  if (requirements.extraQuestions.includes("RD_RDN") && value.holdsRdRdn === undefined) {
    fieldErrors.holdsRdRdn = "Please answer this question";
  }
  if (requirements.extraQuestions.includes("HSP") && value.hspCertified === undefined) {
    fieldErrors.hspCertified = "Please answer this question";
  }
  if (requirements.extraQuestions.includes("APRN_CATEGORY") && !value.aprnCategory) {
    fieldErrors.aprnCategory = "Select your APRN category";
  }
  if (requirements.extraQuestions.includes("SUPERVISOR")) {
    if (!value.supervisorName) fieldErrors.supervisorName = "Required";
    if (!value.supervisorLicenseType) fieldErrors.supervisorLicenseType = "Required";
    if (!value.supervisorLicenseNumber) fieldErrors.supervisorLicenseNumber = "Required";
  }
  if (requirements.scopeAcknowledgement && !value.scopeAcknowledged) {
    fieldErrors.scopeAcknowledged = "You must acknowledge your scope of practice";
  }

  const bundle = await getApplicationBundle(professionalId);
  const credentials = bundle?.credentials ?? [];
  for (const requirement of requirements.credentials) {
    if (!requirement.required || requirement.manualReviewIfMissing) continue;
    const present = credentials.some((c) => c.credential_type === requirement.credentialType);
    if (!present) {
      fieldErrors[`credential.${requirement.credentialType}`] =
        `${requirement.label} is required`;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Please complete your required credentials.", fieldErrors);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("professional_profiles")
    .update({
      holds_rd_rdn: value.holdsRdRdn ?? null,
      hsp_certified: value.hspCertified ?? null,
      aprn_category: value.aprnCategory ?? null,
      supervisor_name: value.supervisorName ?? null,
      supervisor_license_type: value.supervisorLicenseType ?? null,
      supervisor_license_number: value.supervisorLicenseNumber ?? null,
      supervising_organization: value.supervisingOrganization ?? null,
    })
    .eq("id", professionalId);

  if (error) return failure(error.message);

  await markStepComplete(application, "credentials");
  revalidateOnboarding();
  redirect(`${ONBOARDING_BASE}/insurance`);
}

// ---------------------------------------------------------------------------
// Step 4 — Insurance & compliance
// ---------------------------------------------------------------------------

export async function saveInsurance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { professionalId, application } = await getOnboardingContext();

  const parsed = insuranceSchema.safeParse({
    id: formString(formData.get("id")),
    insuranceType: formData.get("insuranceType"),
    carrierName: formData.get("carrierName"),
    policyNumber: formData.get("policyNumber"),
    coveragePerClaim: formString(formData.get("coveragePerClaim")),
    coverageAggregate: formString(formData.get("coverageAggregate")),
    effectiveDate: formData.get("effectiveDate"),
    expirationDate: formData.get("expirationDate"),
    certificateDocumentId: formString(formData.get("certificateDocumentId")),
  });

  if (!parsed.success) {
    return failure("Please fix the highlighted fields.", toFieldErrors(parsed.error));
  }

  const value = parsed.data;
  const supabase = await createClient();

  const payload = {
    professional_id: professionalId,
    insurance_type: value.insuranceType,
    carrier_name: value.carrierName,
    policy_number: value.policyNumber,
    coverage_per_claim: value.coveragePerClaim ?? null,
    coverage_aggregate: value.coverageAggregate ?? null,
    effective_date: value.effectiveDate,
    expiration_date: value.expirationDate,
    certificate_document_id: value.certificateDocumentId,
    status: "SUBMITTED" as const,
  };

  const { error } = value.id
    ? await supabase
        .from("insurance_policies")
        .update(payload)
        .eq("id", value.id)
        .eq("professional_id", professionalId)
    : await supabase.from("insurance_policies").insert(payload);

  if (error) return failure(error.message);

  await reopenForReview(application, "Insurance policy updated.");
  revalidateOnboarding();
  return success("Insurance saved.");
}

export async function deleteInsurance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { professionalId } = await getOnboardingContext();
  const id = formString(formData.get("id"));
  if (!id) return failure("Missing policy.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("insurance_policies")
    .delete()
    .eq("id", id)
    .eq("professional_id", professionalId);

  if (error) return failure(error.message);
  revalidateOnboarding();
  return success("Policy removed.");
}

export async function saveComplianceStep(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { professionalId, application } = await getOnboardingContext();

  const disclosures = DISCLOSURE_TYPES.map((type) => ({
    disclosureType: type,
    answer: formBoolean(formData.get(`${type}.answer`)),
    explanation: formString(formData.get(`${type}.explanation`)),
    supportingDocumentId: formString(formData.get(`${type}.documentId`)),
  }));

  const parsed = disclosuresSchema.safeParse({ disclosures });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const index = issue.path[1];
      const field = issue.path[2];
      if (typeof index === "number" && field) {
        fieldErrors[`${DISCLOSURE_TYPES[index]}.${String(field)}`] = issue.message;
      }
    }
    return failure("Please explain any disclosures you answered yes to.", fieldErrors);
  }

  const supabase = await createClient();
  const bundle = await getApplicationBundle(professionalId);
  const requiresInsurance = true;
  if (requiresInsurance && (bundle?.insurancePolicies.length ?? 0) === 0) {
    return failure("Add at least one insurance policy before continuing.");
  }

  for (const disclosure of parsed.data.disclosures) {
    const { error } = await supabase.from("compliance_disclosures").upsert(
      {
        professional_id: professionalId,
        disclosure_type: disclosure.disclosureType,
        answer: disclosure.answer,
        explanation: disclosure.explanation ?? null,
        supporting_document_id: disclosure.supportingDocumentId ?? null,
      },
      { onConflict: "professional_id,disclosure_type" },
    );
    if (error) return failure(error.message);
  }

  // Any yes answer routes the application to a human reviewer.
  const anyYes = parsed.data.disclosures.some((d) => d.answer);
  if (anyYes) {
    const { error: flagError } = await supabase
      .from("professional_applications")
      .update({ manual_review_required: true })
      .eq("id", application.id);

    // A disclosed issue that never reaches a reviewer is the whole point of
    // this step failing open.
    if (flagError) {
      return failure(
        `Could not flag your disclosures for review: ${flagError.message}`,
      );
    }
  }

  await markStepComplete(application, "insurance");
  revalidateOnboarding();
  redirect(`${ONBOARDING_BASE}/who-you-help`);
}

// ---------------------------------------------------------------------------
// Step 5 — Who you help
// ---------------------------------------------------------------------------

export async function saveCapabilities(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { professionalId, profile, application } = await getOnboardingContext();
  if (!profile.profession_type) return failure("Select your profession in step 1 first.");

  const parsed = capabilitiesSchema.safeParse({
    clientPopulations: formData.getAll("clientPopulations"),
    dexaCapabilities: formData.getAll("dexaCapabilities"),
  });

  if (!parsed.success) {
    return failure("Select at least one option in each group.", toFieldErrors(parsed.error));
  }

  // Scope enforcement: anything outside the profession's allow-list is dropped,
  // even if the client submitted it.
  const submitted = [...parsed.data.clientPopulations, ...parsed.data.dexaCapabilities];
  const allowed = filterAllowedCapabilities(profile.profession_type, submitted);

  if (allowed.length === 0) {
    return failure("Select at least one capability within your scope of practice.");
  }

  const supabase = await createClient();
  await supabase
    .from("professional_capabilities")
    .delete()
    .eq("professional_id", professionalId);

  const { error } = await supabase.from("professional_capabilities").insert(
    allowed.map((code) => ({ professional_id: professionalId, capability_code: code })),
  );
  if (error) return failure(error.message);

  await markStepComplete(application, "who-you-help");
  revalidateOnboarding();
  redirect(`${ONBOARDING_BASE}/services`);
}

// ---------------------------------------------------------------------------
// Step 6 — Services
// ---------------------------------------------------------------------------

export async function saveService(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { professionalId } = await getOnboardingContext();

  const parsed = serviceOfferingSchema.safeParse({
    id: formString(formData.get("id")),
    serviceName: formData.get("serviceName"),
    serviceDescription: formData.get("serviceDescription"),
    serviceCategory: formData.get("serviceCategory"),
    modality: formData.get("modality"),
    durationMinutes: formData.get("durationMinutes"),
    priceAmount: formString(formData.get("priceAmount")),
    freeIntroConsult: formBoolean(formData.get("freeIntroConsult")),
    bookingUrl: formData.get("bookingUrl"),
    acceptsSelfPay: formBoolean(formData.get("acceptsSelfPay")),
    acceptsInsurance: formBoolean(formData.get("acceptsInsurance")),
    insuranceNotes: formData.get("insuranceNotes"),
  });

  if (!parsed.success) {
    return failure("Please fix the highlighted fields.", toFieldErrors(parsed.error));
  }

  const value = parsed.data;
  const supabase = await createClient();

  const payload = {
    professional_id: professionalId,
    service_name: value.serviceName,
    service_description: value.serviceDescription,
    service_category: value.serviceCategory,
    modality: value.modality,
    duration_minutes: value.durationMinutes,
    price_amount: value.priceAmount ?? null,
    free_intro_consult: value.freeIntroConsult,
    booking_url: value.bookingUrl ?? null,
    accepts_self_pay: value.acceptsSelfPay,
    accepts_insurance: value.acceptsInsurance,
    insurance_notes: value.insuranceNotes ?? null,
  };

  const { error } = value.id
    ? await supabase
        .from("service_offerings")
        .update(payload)
        .eq("id", value.id)
        .eq("professional_id", professionalId)
    : await supabase.from("service_offerings").insert(payload);

  if (error) return failure(error.message);

  revalidateOnboarding();
  return success("Service saved.");
}

export async function deleteService(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { professionalId } = await getOnboardingContext();
  const id = formString(formData.get("id"));
  if (!id) return failure("Missing service.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_offerings")
    .delete()
    .eq("id", id)
    .eq("professional_id", professionalId);

  if (error) return failure(error.message);
  revalidateOnboarding();
  return success("Service removed.");
}

export async function completeServicesStep(): Promise<void> {
  const { professionalId, application } = await getOnboardingContext();
  const bundle = await getApplicationBundle(professionalId);
  if ((bundle?.services.length ?? 0) === 0) return;

  await markStepComplete(application, "services");
  revalidateOnboarding();
  redirect(`${ONBOARDING_BASE}/locations`);
}

// ---------------------------------------------------------------------------
// Step 7 — Where you practice
// ---------------------------------------------------------------------------

export async function saveLocation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { professionalId, profile } = await getOnboardingContext();

  const parsed = serviceLocationSchema.safeParse({
    id: formString(formData.get("id")),
    country: formData.get("country"),
    state: formData.get("state"),
    city: formData.get("city"),
    postalCode: formData.get("postalCode"),
    address1: formData.get("address1"),
    address2: formData.get("address2"),
    serviceMode: formData.get("serviceMode"),
  });

  if (!parsed.success) {
    return failure("Please fix the highlighted fields.", toFieldErrors(parsed.error));
  }

  const value = parsed.data;
  const supabase = await createClient();

  const payload = {
    professional_id: professionalId,
    country: value.country,
    state: value.state,
    city: value.city ?? null,
    postal_code: value.postalCode ?? null,
    address_1: value.address1 ?? null,
    address_2: value.address2 ?? null,
    service_mode: value.serviceMode,
  };

  const { error } = value.id
    ? await supabase
        .from("service_locations")
        .update(payload)
        .eq("id", value.id)
        .eq("professional_id", professionalId)
    : await supabase.from("service_locations").insert(payload);

  if (error) return failure(error.message);

  // Mirror the location into a service jurisdiction, linked to a license held in
  // that state when one exists. This is the hook nationwide expansion builds on.
  if (profile.profession_type) {
    const { data: credentials } = await supabase
      .from("credentials")
      .select("id, credential_type, jurisdiction_state")
      .eq("professional_id", professionalId);

    const licenseInState = credentials?.find(
      (c) =>
        (c.credential_type === "STATE_LICENSE" ||
          c.credential_type === "RN_LICENSE" ||
          c.credential_type === "APRN_AUTHORIZATION") &&
        c.jurisdiction_state === value.state,
    );

    const { error: jurisdictionError } = await supabase
      .from("professional_service_jurisdictions")
      .upsert(
        {
          professional_id: professionalId,
          country: value.country,
          state: value.state,
          profession_type: profile.profession_type,
          credential_id: licenseInState?.id ?? null,
          virtual_allowed: value.serviceMode !== "IN_PERSON",
          in_person_allowed: value.serviceMode !== "VIRTUAL",
        },
        { onConflict: "professional_id,country,state" },
      );

    if (jurisdictionError) {
      return failure(
        `Could not record where you are licensed to serve: ${jurisdictionError.message}`,
      );
    }
  }

  revalidateOnboarding();
  return success("Location saved.");
}

export async function deleteLocation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { professionalId } = await getOnboardingContext();
  const id = formString(formData.get("id"));
  if (!id) return failure("Missing location.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_locations")
    .delete()
    .eq("id", id)
    .eq("professional_id", professionalId);

  if (error) return failure(error.message);
  revalidateOnboarding();
  return success("Location removed.");
}

export async function completeLocationsStep(): Promise<void> {
  const { professionalId, application } = await getOnboardingContext();
  const bundle = await getApplicationBundle(professionalId);
  if ((bundle?.locations.length ?? 0) === 0) return;

  await markStepComplete(application, "locations");
  revalidateOnboarding();
  redirect(`${ONBOARDING_BASE}/attestations`);
}

// ---------------------------------------------------------------------------
// Step 8 — Attestations
// ---------------------------------------------------------------------------

export async function saveAttestations(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { professionalId, application } = await getOnboardingContext();

  const parsed = attestationsSchema.safeParse({
    acceptedTypes: formData.getAll("accepted"),
    electronicSignature: formData.get("electronicSignature"),
    signatureDate: formData.get("signatureDate"),
  });

  if (!parsed.success) {
    return failure("Please complete all attestations.", toFieldErrors(parsed.error));
  }

  const accepted = new Set(parsed.data.acceptedTypes);
  const missing = ATTESTATION_TYPES.filter((t) => !accepted.has(t));
  if (missing.length > 0) {
    return failure("All attestations are required to submit an application.");
  }

  const headerList = await headers();
  const ipAddress =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    null;

  const supabase = await createClient();
  const now = new Date().toISOString();

  for (const type of ATTESTATION_TYPES) {
    const { error } = await supabase.from("attestations").upsert(
      {
        professional_id: professionalId,
        attestation_type: type,
        agreement_version: AGREEMENT_VERSION,
        accepted: true,
        accepted_at: now,
        ip_address: ipAddress,
      },
      { onConflict: "professional_id,attestation_type,agreement_version" },
    );
    if (error) return failure(error.message);
  }

  const { error } = await supabase
    .from("professional_applications")
    .update({
      electronic_signature: parsed.data.electronicSignature,
      signature_date: parsed.data.signatureDate,
    })
    .eq("id", application.id);

  if (error) return failure(error.message);

  await markStepComplete(application, "attestations");
  revalidateOnboarding();
  redirect(`${ONBOARDING_BASE}/review`);
}

// ---------------------------------------------------------------------------
// Step 9 — Submit
// ---------------------------------------------------------------------------

export async function submitApplication(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { professionalId, profile, application } = await getOnboardingContext();

  const bundle = await getApplicationBundle(professionalId);
  if (!bundle) return failure("Application not found.");
  if (!profile.profession_type) return failure("Select your profession in step 1 first.");

  const jurisdiction = primaryJurisdiction(bundle);
  const requirements = getRequirements(profile.profession_type, jurisdiction);

  // Submission-time validation runs server-side regardless of what the wizard
  // allowed the client to do.
  const problems: string[] = [];

  for (const requirement of requirements.credentials) {
    if (!requirement.required || requirement.manualReviewIfMissing) continue;
    const credential = bundle.credentials.find(
      (c) => c.credential_type === requirement.credentialType,
    );
    if (!credential) {
      problems.push(`Missing required credential: ${requirement.label}.`);
      continue;
    }
    if (requirement.requiresDocument && !credential.document_id) {
      problems.push(`Upload documentation for ${requirement.label}.`);
    }
  }

  if (requirements.insuranceRequired && bundle.insurancePolicies.length === 0) {
    problems.push("Professional liability insurance is required.");
  }
  if (bundle.insurancePolicies.some((p) => !p.certificate_document_id)) {
    problems.push("Upload a certificate of insurance for each policy.");
  }
  if (bundle.capabilities.length === 0) {
    problems.push("Select who you help.");
  }
  if (bundle.services.length === 0) {
    problems.push("Add at least one service.");
  }
  if (bundle.locations.length === 0) {
    problems.push("Add at least one practice location.");
  }
  if (bundle.disclosures.length !== DISCLOSURE_TYPES.length) {
    problems.push("Answer all compliance questions.");
  }
  const acceptedTypes = new Set(
    bundle.attestations.filter((a) => a.accepted).map((a) => a.attestation_type),
  );
  if (ATTESTATION_TYPES.some((t) => !acceptedTypes.has(t))) {
    problems.push("Accept all attestations.");
  }
  if (!application.electronic_signature) {
    problems.push("Sign the application.");
  }
  if (!profile.profile_photo_document_id) {
    problems.push("Upload a profile photo.");
  }

  if (problems.length > 0) {
    return failure(problems.join(" "));
  }

  const manualReview =
    requirements.manualReviewRequired ||
    !requirements.independentListingAllowed ||
    bundle.disclosures.some((d) => d.answer) ||
    (profile.profession_type === "PSYCHOLOGIST" && !profile.hsp_certified);

  const supabase = await createClient();
  const { error } = await supabase
    .from("professional_applications")
    .update({
      status: "SUBMITTED",
      submitted_at: new Date().toISOString(),
      manual_review_required: manualReview,
      completed_steps: Array.from(new Set([...application.completed_steps, "review"])),
    })
    .eq("id", application.id)
    .eq("professional_id", professionalId);

  if (error) return failure(error.message);

  const { error: auditError } = await supabase
    .from("application_review_events")
    .insert({
      application_id: application.id,
      event_type: "SUBMITTED",
      from_status: application.status,
      to_status: "SUBMITTED",
      note: manualReview ? "Flagged for manual review on submission." : null,
    });

  // A dropped audit write is not worth failing a submission over, but it must
  // never pass unnoticed the way it did when the insert policy silently rejected
  // this event.
  if (auditError) {
    console.error("Failed to record submission in the audit trail:", auditError);
  }

  revalidateOnboarding();
  redirect(`${ONBOARDING_BASE}/status`);
}
