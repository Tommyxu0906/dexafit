import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationBundle } from "../../data/types";

const updateSpy = vi.fn();
const insertSpy = vi.fn();
let bundle: ApplicationBundle;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("../../auth", () => ({
  requireAdmin: vi.fn(async () => ({
    id: "admin-1",
    email: "reviewer@dexafit.com",
    role: "ADMIN" as const,
  })),
}));

vi.mock("../../supabase/server", () => ({
  createClient: async () => ({
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data:
                table === "professional_applications"
                  ? {
                      id: "app-1",
                      status: "CREDENTIAL_REVIEW",
                      professional_id: "prof-1",
                    }
                  : null,
            }),
          }),
        }),
        update: (payload: unknown) => {
          updateSpy(table, payload);
          return { eq: async () => ({ error: null }) };
        },
        insert: (payload: unknown) => {
          insertSpy(table, payload);
          return { error: null };
        },
      };
    },
  }),
}));

// The real readiness mapping is kept; only the stored bundle is swapped, which
// is what makes this a genuine test of "approve re-reads and recomputes".
vi.mock("../../data/professional", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../data/professional")>();
  return {
    ...actual,
    getApplicationBundle: async () => bundle,
  };
});

const { decideApplication } = await import("../admin");

function buildBundle(overrides: {
  credentialExpiration: string;
  verificationStatus?: string;
}): ApplicationBundle {
  return {
    profile: {
      id: "prof-1",
      user_id: "user-1",
      legal_first_name: "Maya",
      legal_last_name: "Reynolds",
      display_name: "Coach Maya",
      profession_type: "PERSONAL_TRAINER",
      professional_title: "CPT",
      bio: "x".repeat(150),
      years_experience: 8,
      languages: ["English"],
      email: "maya@example.com",
      phone: "+16175550123",
      profile_photo_document_id: "doc-1",
      website_url: null,
      linkedin_url: null,
      instagram_url: null,
      joining_as: "INDIVIDUAL",
      practice_name: null,
      organization_id: null,
      business_email: null,
      business_phone: null,
      business_website: null,
      service_modes: ["IN_PERSON"],
      accepting_new_clients: true,
      holds_rd_rdn: null,
      hsp_certified: null,
      aprn_category: null,
      supervisor_name: null,
      supervisor_license_type: null,
      supervisor_license_number: null,
      supervising_organization: null,
      marketplace_status: "INACTIVE",
      created_at: "",
      updated_at: "",
    },
    application: {
      id: "app-1",
      professional_id: "prof-1",
      status: "CREDENTIAL_REVIEW",
      completed_steps: [],
      manual_review_required: false,
      independent_listing_eligible: null,
      electronic_signature: "Maya Reynolds",
      signature_date: "2026-09-01",
      submitted_at: "2026-09-01T00:00:00Z",
      reviewed_by: null,
      reviewed_at: null,
      admin_notes: null,
      created_at: "",
      updated_at: "",
    },
    credentials: [
      {
        id: "cred-1",
        professional_id: "prof-1",
        credential_type: "NATIONAL_CERTIFICATION",
        credential_name: "NASM CPT",
        credential_number: "1",
        issuing_authority: "NASM",
        jurisdiction_country: "US",
        jurisdiction_state: "MA",
        issue_date: "2024-01-01",
        expiration_date: overrides.credentialExpiration,
        verification_status: (overrides.verificationStatus ?? "VERIFIED") as "VERIFIED",
        verification_source_url: null,
        verified_at: "2026-09-02T00:00:00Z",
        verified_by: "admin-1",
        admin_notes: null,
        document_id: "doc-2",
        created_at: "",
        updated_at: "",
      },
      {
        id: "cred-2",
        professional_id: "prof-1",
        credential_type: "CPR_AED",
        credential_name: "CPR/AED",
        credential_number: "2",
        issuing_authority: "AHA",
        jurisdiction_country: "US",
        jurisdiction_state: null,
        issue_date: "2024-01-01",
        expiration_date: "2099-01-01",
        verification_status: "VERIFIED",
        verification_source_url: null,
        verified_at: "2026-09-02T00:00:00Z",
        verified_by: "admin-1",
        admin_notes: null,
        document_id: "doc-3",
        created_at: "",
        updated_at: "",
      },
    ],
    insurancePolicies: [
      {
        id: "ins-1",
        professional_id: "prof-1",
        insurance_type: "PROFESSIONAL_LIABILITY",
        carrier_name: "Acme",
        policy_number: "POL-1",
        coverage_per_claim: 1000000,
        coverage_aggregate: 3000000,
        effective_date: "2026-01-01",
        expiration_date: "2099-01-01",
        certificate_document_id: "doc-4",
        status: "VERIFIED",
        verified_at: null,
        verified_by: null,
        admin_notes: null,
        created_at: "",
        updated_at: "",
      },
    ],
    disclosures: [],
    documents: [],
    services: [],
    locations: [
      {
        id: "loc-1",
        professional_id: "prof-1",
        country: "US",
        state: "MA",
        city: "Boston",
        postal_code: "02110",
        address_1: "1 Main St",
        address_2: null,
        service_mode: "IN_PERSON",
      },
    ],
    jurisdictions: [],
    capabilities: [],
    attestations: [],
  };
}

function approvalForm(extra: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("applicationId", "app-1");
  formData.set("decision", "approve");
  for (const [k, v] of Object.entries(extra)) formData.set(k, v);
  return formData;
}

describe("admin approval recomputes readiness server-side", () => {
  beforeEach(() => {
    updateSpy.mockClear();
    insertSpy.mockClear();
  });

  it("approves when the freshly loaded state satisfies every rule", async () => {
    bundle = buildBundle({ credentialExpiration: "2099-01-01" });

    const result = await decideApplication({ ok: false }, approvalForm());

    expect(result.ok).toBe(true);
    const approved = updateSpy.mock.calls.find(
      ([table, payload]) =>
        table === "professional_applications" &&
        (payload as { status?: string }).status === "APPROVED",
    );
    expect(approved).toBeDefined();
  });

  it("refuses approval when a credential expired after the reviewer loaded the page", async () => {
    // The page rendered while this credential was valid; by the time the
    // approval request lands, it has lapsed.
    bundle = buildBundle({ credentialExpiration: "2026-01-01" });

    const result = await decideApplication({ ok: false }, approvalForm());

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/expired/i);

    // Nothing may be written: not the application, not the marketplace listing.
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("refuses approval when a credential was un-verified after page load", async () => {
    bundle = buildBundle({
      credentialExpiration: "2099-01-01",
      verificationStatus: "UNABLE_TO_VERIFY",
    });

    const result = await decideApplication({ ok: false }, approvalForm());

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not been verified/i);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("ignores client-submitted readiness and recomputes from stored state", async () => {
    bundle = buildBundle({ credentialExpiration: "2026-01-01" });

    // A forged client claiming everything is fine changes nothing.
    const result = await decideApplication(
      { ok: false },
      approvalForm({
        ready: "true",
        readiness: "READY",
        independentListingEligible: "true",
        blockers: "[]",
      }),
    );

    expect(result.ok).toBe(false);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("never marks the marketplace listing active on a refused approval", async () => {
    bundle = buildBundle({ credentialExpiration: "2026-01-01" });

    await decideApplication({ ok: false }, approvalForm());

    const activated = updateSpy.mock.calls.find(
      ([table, payload]) =>
        table === "professional_profiles" &&
        (payload as { marketplace_status?: string }).marketplace_status === "ACTIVE",
    );
    expect(activated).toBeUndefined();
  });
});
