import { createClient } from "../supabase/server";
import type {
  ApplicationBundle,
  ApplicationRow,
  ProfessionalProfileRow,
} from "./types";


/**
 * Resolves the signed-in user's professional profile, creating the draft profile
 * and application on first visit. The professional id is always derived from the
 * session, never accepted from the client.
 *
 * A layout and the page it wraps both call this and render concurrently, so on a
 * first visit they race to create the same row. Both upserts below settle that in
 * the database — `insert ... on conflict do update ... returning` either creates
 * the row or hands back the one the other request just committed, in a single
 * statement. Reading first and inserting second cannot be made correct here: the
 * loser of the race has to re-read, and a re-read that comes back empty leaves
 * nothing sensible to do.
 *
 * Only `user_id` / `professional_id` are sent, so the conflict branch rewrites
 * the key to itself and every other column on an existing row is left alone.
 */
export async function getOrCreateProfessional(
  userId: string,
): Promise<{ profile: ProfessionalProfileRow; application: ApplicationRow }> {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("professional_profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (profileError || !profile) {
    throw new Error(
      `Could not resolve professional profile: ${profileError?.message ?? "no row returned"}`,
    );
  }

  const { data: application, error: applicationError } = await supabase
    .from("professional_applications")
    .upsert(
      { professional_id: profile.id },
      { onConflict: "professional_id" },
    )
    .select("*")
    .single();

  if (applicationError || !application) {
    throw new Error(
      `Could not resolve application: ${applicationError?.message ?? "no row returned"}`,
    );
  }

  return {
    profile: profile as ProfessionalProfileRow,
    application: application as ApplicationRow,
  };
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

  // A failed read must not read as "you have none of these". Showing an empty
  // credential list because a query errored would tell a provider their uploads
  // vanished, and would let readiness draw conclusions from data it never saw.
  const failed = [
    ["profile", profileRes],
    ["application", applicationRes],
    ["credentials", credentialsRes],
    ["insurance", insuranceRes],
    ["disclosures", disclosuresRes],
    ["documents", documentsRes],
    ["services", servicesRes],
    ["locations", locationsRes],
    ["jurisdictions", jurisdictionsRes],
    ["capabilities", capabilitiesRes],
    ["attestations", attestationsRes],
  ].filter(([, res]) => (res as { error: unknown }).error) as [
    string,
    { error: { message: string } },
  ][];

  if (failed.length > 0) {
    throw new Error(
      `Could not load the application: ${failed
        .map(([name, res]) => `${name} (${res.error.message})`)
        .join(", ")}`,
    );
  }

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
      professionTypes: bundle.profile.profession_types,
      legalFirstName: bundle.profile.legal_first_name,
      legalLastName: bundle.profile.legal_last_name,
      displayName: bundle.profile.display_name,
      email: bundle.profile.email,
      phone: bundle.profile.phone,
      bio: bundle.profile.bio,
      yearsExperience: bundle.profile.years_experience,
      languages: bundle.profile.languages,
      profilePhotoDocumentId: bundle.profile.profile_photo_document_id,
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
