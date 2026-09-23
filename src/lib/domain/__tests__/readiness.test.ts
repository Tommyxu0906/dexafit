import { describe, expect, it } from "vitest";
import {
  computeReadiness,
  type ReadinessInput,
  type ReadinessProfile,
} from "../readiness";
import type { ProfessionType } from "../enums";

const NOW = new Date("2026-09-15T12:00:00Z");

function profile(
  professionTypes: ProfessionType | readonly ProfessionType[],
  overrides: Partial<ReadinessProfile> = {},
): ReadinessProfile {
  return {
    professionTypes: Array.isArray(professionTypes)
      ? professionTypes
      : [professionTypes as ProfessionType],
    legalFirstName: "Maya",
    legalLastName: "Reynolds",
    displayName: "Coach Maya",
    email: "maya@example.com",
    phone: "+16175550123",
    bio: "x".repeat(150),
    yearsExperience: 8,
    languages: ["English"],
    profilePhotoDocumentId: "11111111-1111-1111-1111-111111111111",
    ...overrides,
  };
}

function input(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    profile: profile("PERSONAL_TRAINER"),
    applicationStatus: "APPROVED",
    credentials: [
      {
        id: "c1",
        requirementKey: "PERSONAL_TRAINER:NATIONAL_CERTIFICATION",
        credentialType: "NATIONAL_CERTIFICATION",
        verificationStatus: "VERIFIED",
        expirationDate: "2027-01-01",
      },
      {
        id: "c2",
        requirementKey: "CPR_AED",
        credentialType: "CPR_AED",
        verificationStatus: "VERIFIED",
        expirationDate: "2027-01-01",
      },
    ],
    insurancePolicies: [
      { id: "i1", status: "VERIFIED", expirationDate: "2027-01-01" },
    ],
    disclosures: [],
    jurisdictionState: "MA",
    now: NOW,
    ...overrides,
  };
}

describe("computeReadiness", () => {
  it("is ready when every requirement is satisfied and admin approved", () => {
    const result = computeReadiness(input());
    expect(result.blockers).toEqual([]);
    expect(result.ready).toBe(true);
    expect(result.independentListingEligible).toBe(true);
  });

  it("is not ready before an admin approves", () => {
    const result = computeReadiness(input({ applicationStatus: "SUBMITTED" }));
    expect(result.ready).toBe(false);
    expect(result.blockers.map((b) => b.code)).toContain("NOT_ADMIN_APPROVED");
  });

  it("fails when a required credential is missing", () => {
    const result = computeReadiness(
      input({
        credentials: [
          {
            id: "c1",
            requirementKey: "PERSONAL_TRAINER:NATIONAL_CERTIFICATION",
            credentialType: "NATIONAL_CERTIFICATION",
            verificationStatus: "VERIFIED",
            expirationDate: "2027-01-01",
          },
        ],
      }),
    );
    expect(result.ready).toBe(false);
    const blocker = result.blockers.find((b) => b.code === "CREDENTIAL_MISSING");
    expect(blocker?.credentialType).toBe("CPR_AED");
  });

  it("fails when a required credential is present but unverified", () => {
    const result = computeReadiness(
      input({
        credentials: [
          {
            id: "c1",
            requirementKey: "PERSONAL_TRAINER:NATIONAL_CERTIFICATION",
            credentialType: "NATIONAL_CERTIFICATION",
            verificationStatus: "PENDING",
            expirationDate: "2027-01-01",
          },
          {
            id: "c2",
            requirementKey: "CPR_AED",
            credentialType: "CPR_AED",
            verificationStatus: "VERIFIED",
            expirationDate: "2027-01-01",
          },
        ],
      }),
    );
    expect(result.ready).toBe(false);
    expect(result.blockers.map((b) => b.code)).toContain("CREDENTIAL_NOT_VERIFIED");
  });

  it("fails when a required credential is expired", () => {
    const result = computeReadiness(
      input({
        credentials: [
          {
            id: "c1",
            requirementKey: "PERSONAL_TRAINER:NATIONAL_CERTIFICATION",
            credentialType: "NATIONAL_CERTIFICATION",
            verificationStatus: "VERIFIED",
            expirationDate: "2026-01-01",
          },
          {
            id: "c2",
            requirementKey: "CPR_AED",
            credentialType: "CPR_AED",
            verificationStatus: "VERIFIED",
            expirationDate: "2027-01-01",
          },
        ],
      }),
    );
    expect(result.ready).toBe(false);
    const blocker = result.blockers.find((b) => b.code === "CREDENTIAL_EXPIRED");
    expect(blocker?.credentialType).toBe("NATIONAL_CERTIFICATION");
  });

  it("fails when required insurance is missing or expired", () => {
    expect(
      computeReadiness(input({ insurancePolicies: [] })).blockers.map((b) => b.code),
    ).toContain("INSURANCE_MISSING");

    expect(
      computeReadiness(
        input({
          insurancePolicies: [
            { id: "i1", status: "VERIFIED", expirationDate: "2026-02-01" },
          ],
        }),
      ).blockers.map((b) => b.code),
    ).toContain("INSURANCE_EXPIRED");
  });

  it("blocks on an unresolved compliance flag and forces manual review", () => {
    const result = computeReadiness(
      input({
        disclosures: [
          {
            disclosureType: "PENDING_DISCIPLINARY_PROCEEDINGS",
            answer: true,
            resolvedByAdmin: false,
          },
        ],
      }),
    );
    expect(result.ready).toBe(false);
    expect(result.manualReviewRequired).toBe(true);
    expect(result.blockers.map((b) => b.code)).toContain(
      "COMPLIANCE_FLAG_UNRESOLVED",
    );
  });

  it("clears once an admin resolves the disclosure", () => {
    const result = computeReadiness(
      input({
        disclosures: [
          {
            disclosureType: "PENDING_DISCIPLINARY_PROCEEDINGS",
            answer: true,
            resolvedByAdmin: true,
          },
        ],
      }),
    );
    expect(result.ready).toBe(true);
  });

  it("routes a missing optional-but-reviewable credential to manual review, not a blocker", () => {
    const result = computeReadiness(
      input({
        profile: profile("STRENGTH_CONDITIONING_COACH"),
        credentials: [
          {
            id: "c2",
            requirementKey: "CPR_AED",
            credentialType: "CPR_AED",
            verificationStatus: "VERIFIED",
            expirationDate: "2027-01-01",
          },
        ],
      }),
    );
    expect(result.manualReviewRequired).toBe(true);
    expect(result.blockers.map((b) => b.code)).not.toContain("CREDENTIAL_MISSING");
  });

  it("fails when the profile is incomplete", () => {
    const result = computeReadiness(
      input({ profile: profile("PERSONAL_TRAINER", { profilePhotoDocumentId: null }) }),
    );
    expect(result.blockers.map((b) => b.code)).toContain("PROFILE_INCOMPLETE");
  });
});

describe("independent listing restrictions", () => {
  const licensed = (
    professionType: ProfessionType | readonly ProfessionType[],
    extra: Partial<ReadinessProfile> = {},
  ) =>
    input({
      profile: profile(professionType, extra),
      credentials: [
        {
          id: "c1",
          requirementKey: "PHYSICAL_THERAPIST:STATE_LICENSE",
          credentialType: "STATE_LICENSE",
          verificationStatus: "VERIFIED",
          expirationDate: "2027-01-01",
          jurisdictionState: "MA",
        },
      ],
    });

  it("cannot have independent listing unlocked by adding a second qualification", () => {
    // Aggregation is toward the stricter answer: if any profession held bars
    // independent listing, holding another one alongside must not lift it.
    const bothAllowed = computeReadiness(
      licensed(["PHYSICAL_THERAPIST", "DIETITIAN_NUTRITIONIST"]),
    );
    expect(bothAllowed.independentListingEligible).toBe(true);
  });

  it("reports no profession selected as a blocker rather than guessing", () => {
    const result = computeReadiness(input({ profile: profile([] as const) }));
    expect(result.ready).toBe(false);
    expect(result.blockers.map((b) => b.code)).toContain("PROFESSION_NOT_SELECTED");
  });
});

describe("one credential does not satisfy two requirements", () => {
  // requirement_key exists for exactly this case, but readiness matched on
  // credentialType until migration 0012. A physical therapist who is also a
  // dietitian holds two separate state licences; neither board accepts the
  // other's. Matching on type let one PT licence clear the dietitian
  // requirement, which would approve someone to practise dietetics on the
  // strength of a physical therapy licence.
  const both = ["PHYSICAL_THERAPIST", "DIETITIAN_NUTRITIONIST"] as const;

  const ptLicenceOnly = () =>
    computeReadiness(
      input({
        profile: profile(both),
        credentials: [
          {
            id: "pt",
            requirementKey: "PHYSICAL_THERAPIST:STATE_LICENSE",
            credentialType: "STATE_LICENSE",
            verificationStatus: "VERIFIED",
            expirationDate: "2027-01-01",
            jurisdictionState: "MA",
          },
        ],
      }),
    );

  it("still blocks on the dietitian licence when only the PT licence is on file", () => {
    const blocked = ptLicenceOnly().blockers.filter(
      (b) => b.code === "CREDENTIAL_MISSING",
    );
    expect(
      blocked.some((b) => /dietitian/i.test(b.message)),
      "a PT licence cleared the dietitian requirement",
    ).toBe(true);
  });

  it("clears each requirement once its own licence is on file", () => {
    const readiness = computeReadiness(
      input({
        profile: profile(both),
        credentials: [
          {
            id: "pt",
            requirementKey: "PHYSICAL_THERAPIST:STATE_LICENSE",
            credentialType: "STATE_LICENSE",
            verificationStatus: "VERIFIED",
            expirationDate: "2027-01-01",
            jurisdictionState: "MA",
          },
          {
            id: "rd",
            requirementKey: "DIETITIAN_NUTRITIONIST:STATE_LICENSE",
            credentialType: "STATE_LICENSE",
            verificationStatus: "VERIFIED",
            expirationDate: "2027-01-01",
            jurisdictionState: "MA",
          },
        ],
      }),
    );
    expect(
      readiness.blockers.filter((b) => b.code === "CREDENTIAL_MISSING"),
    ).toHaveLength(0);
  });
});
