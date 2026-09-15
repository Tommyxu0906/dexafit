import { describe, expect, it } from "vitest";
import {
  computeReadiness,
  evaluateIndependentListing,
  type ReadinessInput,
  type ReadinessProfile,
} from "../readiness";
import type { ProfessionType } from "../enums";

const NOW = new Date("2026-09-15T12:00:00Z");

function profile(
  professionType: ProfessionType,
  overrides: Partial<ReadinessProfile> = {},
): ReadinessProfile {
  return {
    professionType,
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
        credentialType: "NATIONAL_CERTIFICATION",
        verificationStatus: "VERIFIED",
        expirationDate: "2027-01-01",
      },
      {
        id: "c2",
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
            credentialType: "NATIONAL_CERTIFICATION",
            verificationStatus: "PENDING",
            expirationDate: "2027-01-01",
          },
          {
            id: "c2",
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
            credentialType: "NATIONAL_CERTIFICATION",
            verificationStatus: "VERIFIED",
            expirationDate: "2026-01-01",
          },
          {
            id: "c2",
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
        profile: profile("SPORTS_PERFORMANCE_COACH"),
        credentials: [
          {
            id: "c2",
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
  const licensed = (professionType: ProfessionType, extra: Partial<ReadinessProfile> = {}) =>
    input({
      profile: profile(professionType, extra),
      credentials: [
        {
          id: "c1",
          credentialType: "STATE_LICENSE",
          verificationStatus: "VERIFIED",
          expirationDate: "2027-01-01",
          jurisdictionState: "MA",
        },
      ],
    });

  it("denies independent listing for LSMHC even with a verified license", () => {
    const result = computeReadiness(licensed("LSMHC"));
    expect(result.independentListingEligible).toBe(false);
    expect(result.ready).toBe(false);
    expect(result.manualReviewRequired).toBe(true);
    expect(result.blockers.map((b) => b.code)).toContain(
      "INDEPENDENT_PRACTICE_NOT_PERMITTED",
    );
  });

  it("denies independent clinical listing for LCSW but allows it for LICSW", () => {
    expect(computeReadiness(licensed("LCSW")).independentListingEligible).toBe(false);
    expect(computeReadiness(licensed("LICSW")).independentListingEligible).toBe(true);
  });

  it("denies independent health-service listing for a psychologist without HSP", () => {
    const withoutHsp = computeReadiness(licensed("PSYCHOLOGIST", { hspCertified: false }));
    expect(withoutHsp.independentListingEligible).toBe(false);
    expect(withoutHsp.independentListingNotice).toMatch(/HSP/);

    const withHsp = computeReadiness(licensed("PSYCHOLOGIST", { hspCertified: true }));
    expect(withHsp.independentListingEligible).toBe(true);
    expect(withHsp.ready).toBe(true);
  });

  it("treats a missing HSP answer as not eligible", () => {
    const { eligible } = evaluateIndependentListing(
      profile("PSYCHOLOGIST", { hspCertified: null }),
      "MA",
    );
    expect(eligible).toBe(false);
  });
});
