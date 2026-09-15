import { createClient } from "../supabase/server";
import type {
  ApplicationBundle,
  ApplicationRow,
  ProfessionalProfileRow,
} from "./types";

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = "23505";

/**
 * Resolves the signed-in user's professional profile, creating the draft profile
 * and application on first visit. The professional id is always derived from the
 * session, never accepted from the client.
 *
 * A layout and the page it wraps both call this and render concurrently, so on a
 * first visit they race to create the same row. Deliberately NOT wrapped in
 * React `cache`: a server action and the re-render it triggers share one request,
 * so a memoized read would hand the re-render the pre-action snapshot and the
 * wizard would show stale progress. The unique violation below is the safe way to
 * settle the race.
 */
export async function getOrCreateProfessional(
  userId: string,
): Promise<{ profile: ProfessionalProfileRow; application: ApplicationRow }> {
  const supabase = await createClient();

  const selectProfile = async () =>
    (
      await supabase
        .from("professional_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()
    ).data as ProfessionalProfileRow | null;

  let profile = await selectProfile();

  if (!profile) {
    const { data, error } = await supabase
      .from("professional_profiles")
      .insert({ user_id: userId })
      .select("*")
      .single();

    if (error) {
      // Someone else created it between our select and insert; theirs is as
      // good as ours.
      if (error.code !== UNIQUE_VIOLATION) {
        throw new Error(`Could not create professional profile: ${error.message}`);
      }
      profile = await selectProfile();
      if (!profile) {
        throw new Error("Could not load professional profile after a concurrent create.");
      }
    } else {
      profile = data as ProfessionalProfileRow;
    }
  }

  const professionalId = profile.id;

  const selectApplication = async () =>
    (
      await supabase
        .from("professional_applications")
        .select("*")
        .eq("professional_id", professionalId)
        .maybeSingle()
    ).data as ApplicationRow | null;

  let application = await selectApplication();

  if (!application) {
    const { data, error } = await supabase
      .from("professional_applications")
      .insert({ professional_id: professionalId })
      .select("*")
      .single();

    if (error) {
      if (error.code !== UNIQUE_VIOLATION) {
        throw new Error(`Could not create application: ${error.message}`);
      }
      application = await selectApplication();
      if (!application) {
        throw new Error("Could not load application after a concurrent create.");
      }
    } else {
      application = data as ApplicationRow;
    }
  }

  return { profile, application };
}

/** Full application graph. RLS restricts this to the owner or an admin. */
export async function getApplicationBundle(
  professionalId: string,
): Promise<ApplicationBundle | null> {
  const supabase = await createClient();

  const [
    profileRes,
    applicationRes,
    credentialsRes,
    insuranceRes,
    disclosuresRes,
    documentsRes,
    servicesRes,
    locationsRes,
    jurisdictionsRes,
    capabilitiesRes,
    attestationsRes,
  ] = await Promise.all([
    supabase.from("professional_profiles").select("*").eq("id", professionalId).maybeSingle(),
    supabase
      .from("professional_applications")
      .select("*")
      .eq("professional_id", professionalId)
      .maybeSingle(),
    supabase
      .from("credentials")
      .select("*")
      .eq("professional_id", professionalId)
      .order("created_at"),
    supabase
      .from("insurance_policies")
      .select("*")
      .eq("professional_id", professionalId)
      .order("created_at"),
    supabase.from("compliance_disclosures").select("*").eq("professional_id", professionalId),
    supabase.from("professional_documents").select("*").eq("professional_id", professionalId),
    supabase
      .from("service_offerings")
      .select("*")
      .eq("professional_id", professionalId)
      .order("created_at"),
    supabase.from("service_locations").select("*").eq("professional_id", professionalId),
    supabase
      .from("professional_service_jurisdictions")
      .select("*")
      .eq("professional_id", professionalId),
    supabase.from("professional_capabilities").select("*").eq("professional_id", professionalId),
    supabase.from("attestations").select("*").eq("professional_id", professionalId),
  ]);

  if (!profileRes.data || !applicationRes.data) return null;

  return {
    profile: profileRes.data as ApplicationBundle["profile"],
    application: applicationRes.data as ApplicationBundle["application"],
    credentials: (credentialsRes.data ?? []) as ApplicationBundle["credentials"],
    insurancePolicies: (insuranceRes.data ?? []) as ApplicationBundle["insurancePolicies"],
    disclosures: (disclosuresRes.data ?? []) as ApplicationBundle["disclosures"],
    documents: (documentsRes.data ?? []) as ApplicationBundle["documents"],
    services: (servicesRes.data ?? []) as ApplicationBundle["services"],
    locations: (locationsRes.data ?? []) as ApplicationBundle["locations"],
    jurisdictions: (jurisdictionsRes.data ?? []) as ApplicationBundle["jurisdictions"],
    capabilities: (capabilitiesRes.data ?? []) as ApplicationBundle["capabilities"],
    attestations: (attestationsRes.data ?? []) as ApplicationBundle["attestations"],
  };
}

/** Maps a bundle onto the readiness engine's input shape. */
export function toReadinessInput(bundle: ApplicationBundle, jurisdictionState: string) {
  return {
    profile: {
      professionType: bundle.profile.profession_type,
      legalFirstName: bundle.profile.legal_first_name,
      legalLastName: bundle.profile.legal_last_name,
      displayName: bundle.profile.display_name,
      email: bundle.profile.email,
      phone: bundle.profile.phone,
      bio: bundle.profile.bio,
      yearsExperience: bundle.profile.years_experience,
      languages: bundle.profile.languages,
      profilePhotoDocumentId: bundle.profile.profile_photo_document_id,
      hspCertified: bundle.profile.hsp_certified,
      supervisorName: bundle.profile.supervisor_name,
      supervisorLicenseNumber: bundle.profile.supervisor_license_number,
    },
    applicationStatus: bundle.application.status,
    credentials: bundle.credentials.map((c) => ({
      id: c.id,
      credentialType: c.credential_type,
      verificationStatus: c.verification_status,
      expirationDate: c.expiration_date,
      jurisdictionState: c.jurisdiction_state,
    })),
    insurancePolicies: bundle.insurancePolicies.map((p) => ({
      id: p.id,
      expirationDate: p.expiration_date,
      status: p.status,
    })),
    disclosures: bundle.disclosures.map((d) => ({
      disclosureType: d.disclosure_type,
      answer: d.answer,
      resolvedByAdmin: d.resolved_by_admin,
    })),
    jurisdictionState,
  };
}

/** Primary jurisdiction a professional is applying to serve. */
export function primaryJurisdiction(bundle: ApplicationBundle): string {
  return (
    bundle.locations[0]?.state ??
    bundle.jurisdictions[0]?.state ??
    bundle.credentials.find((c) => c.jurisdiction_state)?.jurisdiction_state ??
    "MA"
  );
}
