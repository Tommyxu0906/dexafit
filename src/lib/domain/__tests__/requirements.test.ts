import { describe, expect, it } from "vitest";
import {
  getRequiredCredentials,
  getRequirements,
} from "../requirements";
import { PROFESSION_TYPES } from "../enums";

const MA = "MA";

describe("getRequirements", () => {
  it("treats a personal trainer certification as a marketplace requirement, not a state license", () => {
    const requirements = getRequirements("PERSONAL_TRAINER", MA);
    const certification = requirements.credentials.find(
      (c) => c.credentialType === "NATIONAL_CERTIFICATION",
    );

    expect(certification).toBeDefined();
    expect(certification!.required).toBe(true);
    expect(certification!.marketplaceRequirement).toBe(true);
    expect(certification!.legalRequirement).toBe(false);

    // No personal-trainer state license exists in MA; we must not imply one.
    expect(
      requirements.credentials.some((c) => c.credentialType === "STATE_LICENSE"),
    ).toBe(false);
    expect(certification!.label).not.toMatch(/license/i);
  });

  it("requires CPR/AED for trainers as a marketplace requirement", () => {
    const cpr = getRequirements("PERSONAL_TRAINER", MA).credentials.find(
      (c) => c.credentialType === "CPR_AED",
    );
    expect(cpr?.required).toBe(true);
    expect(cpr?.legalRequirement).toBe(false);
    expect(cpr?.marketplaceRequirement).toBe(true);
  });

  it("requires a state license for licensed professions and labels the jurisdiction", () => {
    for (const profession of [
      "PHYSICAL_THERAPIST",
      "ATHLETIC_TRAINER",
      "DIETITIAN_NUTRITIONIST",
      "PHYSICIAN",
      "PHYSICIAN_ASSISTANT",
      "LMHC",
      "LMFT",
      "LICSW",
      "PSYCHOLOGIST",
    ] as const) {
      const license = getRequirements(profession, MA).credentials.find(
        (c) => c.credentialType === "STATE_LICENSE",
      );
      expect(license, `${profession} should require a state license`).toBeDefined();
      expect(license!.required).toBe(true);
      expect(license!.legalRequirement).toBe(true);
      expect(license!.label).toMatch(/^Massachusetts /);
    }
  });

  it("keeps the dietitian state license separate from the RD/RDN credential question", () => {
    const requirements = getRequirements("DIETITIAN_NUTRITIONIST", MA);
    expect(requirements.extraQuestions).toContain("RD_RDN");
    // The license alone must never imply RD/RDN registration.
    expect(
      requirements.credentials.some((c) => /RD\/RDN/i.test(c.label)),
    ).toBe(false);
  });

  it("requires RN license, APRN authorization and national certification for NPs", () => {
    const types = getRequiredCredentials("NURSE_PRACTITIONER", MA).map(
      (c) => c.credentialType,
    );
    expect(types).toContain("RN_LICENSE");
    expect(types).toContain("APRN_AUTHORIZATION");
    expect(types).toContain("NATIONAL_CERTIFICATION");
    expect(getRequirements("NURSE_PRACTITIONER", MA).extraQuestions).toContain(
      "APRN_CATEGORY",
    );
  });

  it("requires NCCPA certification for physician assistants", () => {
    const pa = getRequirements("PHYSICIAN_ASSISTANT", MA);
    expect(
      pa.credentials.some(
        (c) => c.required && c.exampleIssuers?.includes("NCCPA"),
      ),
    ).toBe(true);
  });

  it("does not collect DEA or MCSR in v1", () => {
    for (const profession of PROFESSION_TYPES) {
      const labels = getRequirements(profession, MA)
        .credentials.map((c) => c.label)
        .join(" ");
      expect(labels).not.toMatch(/DEA|MCSR/i);
    }
  });

  it("blocks independent listing for LSMHC and LCSW", () => {
    expect(getRequirements("LSMHC", MA).independentListingAllowed).toBe(false);
    expect(getRequirements("LSMHC", MA).manualReviewRequired).toBe(true);
    expect(getRequirements("LSMHC", MA).extraQuestions).toContain("SUPERVISOR");

    expect(getRequirements("LCSW", MA).independentListingAllowed).toBe(false);
    expect(getRequirements("LCSW", MA).manualReviewRequired).toBe(true);
  });

  it("allows independent listing for LICSW", () => {
    expect(getRequirements("LICSW", MA).independentListingAllowed).toBe(true);
  });

  it("routes sports performance coaches without a certification to manual review", () => {
    const cert = getRequirements("SPORTS_PERFORMANCE_COACH", MA).credentials.find(
      (c) => c.credentialType === "NATIONAL_CERTIFICATION",
    );
    expect(cert?.manualReviewIfMissing).toBe(true);
  });

  it("attaches scope acknowledgements to scope-sensitive coaching categories", () => {
    expect(getRequirements("NUTRITION_COACH", MA).scopeAcknowledgement).toMatch(
      /licensed dietitian/i,
    );
    expect(getRequirements("HEALTH_WELLNESS_COACH", MA).scopeAcknowledgement).toMatch(
      /psychotherapy/i,
    );
  });

  it("falls back to manual review in unresearched jurisdictions instead of asserting rules", () => {
    const ny = getRequirements("PHYSICAL_THERAPIST", "NY");
    expect(ny.manualReviewRequired).toBe(true);
    expect(ny.jurisdictionResearched).toBe(false);
    // Still required, but not labeled with a state we have not verified.
    expect(
      ny.credentials.find((c) => c.credentialType === "STATE_LICENSE")?.required,
    ).toBe(true);
    expect(
      ny.credentials.find((c) => c.credentialType === "STATE_LICENSE")?.label,
    ).not.toMatch(/Massachusetts/);
  });

  it("defines requirements for every profession type", () => {
    for (const profession of PROFESSION_TYPES) {
      expect(getRequirements(profession, MA).professionType).toBe(profession);
    }
  });
});
