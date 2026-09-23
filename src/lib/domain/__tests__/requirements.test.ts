import { describe, expect, it } from "vitest";
import {
  getRequiredCredentials,
  getRequirements,
  requirementKey,
} from "../requirements";
import { PROFESSION_TYPES } from "../enums";

const MA = "MA";

describe("getRequirements", () => {
  it("treats a personal trainer certification as a marketplace requirement, not a state license", () => {
    const requirements = getRequirements(["PERSONAL_TRAINER"], MA);
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
    const cpr = getRequirements(["PERSONAL_TRAINER"], MA).credentials.find(
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
    ] as const) {
      const license = getRequirements([profession], MA).credentials.find(
        (c) => c.credentialType === "STATE_LICENSE",
      );
      expect(license, `${profession} should require a state license`).toBeDefined();
      expect(license!.required).toBe(true);
      expect(license!.legalRequirement).toBe(true);
      expect(license!.label).toMatch(/^Massachusetts /);
    }
  });

  it("keeps the dietitian state license separate from the RD/RDN credential question", () => {
    const requirements = getRequirements(["DIETITIAN_NUTRITIONIST"], MA);
    expect(requirements.extraQuestions).toContain("RD_RDN");
    // The license alone must never imply RD/RDN registration.
    expect(requirements.credentials.some((c) => /RD\/RDN/i.test(c.label))).toBe(false);
  });

  it("requires RN license, APRN authorization and national certification for NPs", () => {
    const types = getRequiredCredentials(["NURSE_PRACTITIONER"], MA).map(
      (c) => c.credentialType,
    );
    expect(types).toContain("RN_LICENSE");
    expect(types).toContain("APRN_AUTHORIZATION");
    expect(types).toContain("NATIONAL_CERTIFICATION");
    expect(getRequirements(["NURSE_PRACTITIONER"], MA).extraQuestions).toContain(
      "APRN_CATEGORY",
    );
  });

  it("requires NCCPA certification for physician assistants", () => {
    const pa = getRequirements(["PHYSICIAN_ASSISTANT"], MA);
    expect(
      pa.credentials.some((c) => c.required && c.exampleIssuers?.includes("NCCPA")),
    ).toBe(true);
  });

  it("does not collect DEA or MCSR in v1", () => {
    for (const profession of PROFESSION_TYPES) {
      const labels = getRequirements([profession], MA)
        .credentials.map((c) => c.label)
        .join(" ");
      expect(labels).not.toMatch(/DEA|MCSR/i);
    }
  });

  it("routes a strength coach without a recognised certification to manual review", () => {
    // This category absorbed the former sports performance coach, which allowed
    // an unfamiliar certification through to a human rather than blocking.
    const cert = getRequirements(["STRENGTH_CONDITIONING_COACH"], MA).credentials.find(
      (c) => c.credentialType === "NATIONAL_CERTIFICATION",
    );
    expect(cert?.manualReviewIfMissing).toBe(true);
  });

  it("attaches scope acknowledgements to scope-sensitive coaching categories", () => {
    expect(getRequirements(["NUTRITION_COACH"], MA).scopeAcknowledgement).toMatch(
      /licensed dietitian/i,
    );
    expect(getRequirements(["HEALTH_WELLNESS_COACH"], MA).scopeAcknowledgement).toMatch(
      /psychotherapy/i,
    );
  });

  it("falls back to manual review in unresearched jurisdictions instead of asserting rules", () => {
    const ny = getRequirements(["PHYSICAL_THERAPIST"], "NY");
    expect(ny.manualReviewRequired).toBe(true);
    expect(ny.jurisdictionResearched).toBe(false);
    // Still required, but not labeled with a state we have not verified.
    expect(ny.credentials.find((c) => c.credentialType === "STATE_LICENSE")?.required).toBe(
      true,
    );
    expect(
      ny.credentials.find((c) => c.credentialType === "STATE_LICENSE")?.label,
    ).not.toMatch(/Massachusetts/);
  });

  it("defines requirements for every profession type", () => {
    for (const profession of PROFESSION_TYPES) {
      expect(getRequirements([profession], MA).professionTypes).toEqual([profession]);
    }
  });

  it("asks for nothing, and defers to a human, when nothing is selected yet", () => {
    const none = getRequirements([], MA);
    expect(none.credentials).toEqual([]);
    expect(none.manualReviewRequired).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Holding more than one profession
// ---------------------------------------------------------------------------

describe("a professional who holds several qualifications", () => {
  it("needs a separate licence for each licensed profession", () => {
    // The whole reason requirements carry a key: matching on credential type
    // alone let one licence tick both boxes.
    const both = getRequirements(["PHYSICAL_THERAPIST", "DIETITIAN_NUTRITIONIST"], MA);
    const licences = both.credentials.filter((c) => c.credentialType === "STATE_LICENSE");

    expect(licences).toHaveLength(2);
    expect(new Set(licences.map((c) => c.key)).size).toBe(2);
    expect(licences.map((c) => c.label).join(" ")).toMatch(/Physical Therapist/);
    expect(licences.map((c) => c.label).join(" ")).toMatch(/Dietitian/);
  });

  it("asks for a shared credential only once", () => {
    // One CPR card covers a person however many things they are qualified for.
    const both = getRequirements(
      ["PERSONAL_TRAINER", "STRENGTH_CONDITIONING_COACH"],
      MA,
    );
    expect(both.credentials.filter((c) => c.credentialType === "CPR_AED")).toHaveLength(1);
  });

  it("keeps discipline-specific certifications distinct", () => {
    const both = getRequirements(["PERSONAL_TRAINER", "NUTRITION_COACH"], MA);
    const certs = both.credentials.filter(
      (c) => c.credentialType === "NATIONAL_CERTIFICATION",
    );
    expect(certs).toHaveLength(2);
  });

  it("unions the extra questions", () => {
    const both = getRequirements(["DIETITIAN_NUTRITIONIST", "NURSE_PRACTITIONER"], MA);
    expect(both.extraQuestions).toContain("RD_RDN");
    expect(both.extraQuestions).toContain("APRN_CATEGORY");
  });

  it("resolves conflicting rules toward the stricter answer", () => {
    // Adding a qualification may add obligations; it must never remove one.
    const coachOnly = getRequirements(["HEALTH_WELLNESS_COACH"], MA);
    const withPhysician = getRequirements(["HEALTH_WELLNESS_COACH", "PHYSICIAN"], MA);

    expect(withPhysician.insuranceRequired).toBe(
      coachOnly.insuranceRequired || getRequirements(["PHYSICIAN"], MA).insuranceRequired,
    );
    expect(withPhysician.credentials.length).toBeGreaterThan(coachOnly.credentials.length);
  });

  it("carries an unresearched jurisdiction across every profession held", () => {
    const ny = getRequirements(["PERSONAL_TRAINER", "PHYSICAL_THERAPIST"], "NY");
    expect(ny.manualReviewRequired).toBe(true);
    expect(ny.jurisdictionResearched).toBe(false);
  });
});

describe("requirementKey", () => {
  it("scopes a licence to its profession", () => {
    expect(requirementKey("PHYSICAL_THERAPIST", "STATE_LICENSE")).not.toBe(
      requirementKey("DIETITIAN_NUTRITIONIST", "STATE_LICENSE"),
    );
  });

  it("does not scope a credential a person holds only once", () => {
    expect(requirementKey("PHYSICAL_THERAPIST", "CPR_AED")).toBe(
      requirementKey("PERSONAL_TRAINER", "CPR_AED"),
    );
    expect(requirementKey("PHYSICIAN", "NPI")).toBe(
      requirementKey("NURSE_PRACTITIONER", "NPI"),
    );
  });
});
