import { describe, expect, it } from "vitest";
import {
  CLIENT_POPULATIONS,
  DEXA_CAPABILITIES,
  CAPABILITY_LABELS,
  allowedCapabilities,
  type CapabilityCode,
} from "../capabilities";
import { PROFESSION_LABELS, PROFESSION_TYPES } from "../enums";
import { getRequirements } from "../requirements";

/**
 * Every profession in the picker has to be walkable end to end. A profession
 * that cannot satisfy a step's own validation is a dead end the provider only
 * discovers halfway through the wizard.
 */
describe.each(PROFESSION_TYPES)("wizard is completable as %s", (profession) => {
  const requirements = getRequirements([profession], "MA");
  const allowed = allowedCapabilities([profession]);

  it("has a human-readable label in the picker", () => {
    expect(PROFESSION_LABELS[profession]).toBeTruthy();
  });

  it("can satisfy step 5, which needs a client population and a DEXA capability", () => {
    const populations = allowed.filter((c) =>
      (CLIENT_POPULATIONS as readonly string[]).includes(c),
    );
    const dexa = allowed.filter((c) =>
      (DEXA_CAPABILITIES as readonly string[]).includes(c),
    );

    expect(populations.length, "no client population is selectable").toBeGreaterThan(0);
    expect(dexa.length, "no DEXA capability is selectable").toBeGreaterThan(0);
  });

  it("offers only capabilities that have a label to render", () => {
    for (const code of allowed) {
      expect(CAPABILITY_LABELS[code as CapabilityCode], `${code} has no label`).toBeTruthy();
    }
  });

  it("describes every required credential well enough to render its form", () => {
    for (const requirement of requirements.credentials) {
      expect(requirement.label, "credential has no label").toBeTruthy();
      // A required credential the provider cannot evidence would block submission
      // with no way forward.
      if (requirement.required && requirement.requiresDocument) {
        expect(requirement.credentialType).toBeTruthy();
      }
    }
  });

  it("has at least one required credential, or is explicitly reviewed by hand", () => {
    const hasRequired = requirements.credentials.some((c) => c.required);
    expect(hasRequired || requirements.manualReviewRequired).toBe(true);
  });

  it("never labels a DexaFit policy requirement as a licence", () => {
    for (const requirement of requirements.credentials) {
      if (!requirement.legalRequirement) {
        expect(
          requirement.label.toLowerCase(),
          `"${requirement.label}" reads as a licence but is only DexaFit policy`,
        ).not.toMatch(/\blicen[sc]e\b/);
      }
    }
  });

  it("explains itself whenever independent listing is denied outright", () => {
    // No profession is barred today, but if one is added the provider has to be
    // told why rather than silently failing readiness.
    if (!requirements.independentListingAllowed) {
      expect(requirements.restrictionNotice).toBeTruthy();
    }
  });
});

describe("clinical scope containment", () => {
  const UNLICENSED = [
    "PERSONAL_TRAINER",
    "STRENGTH_CONDITIONING_COACH",
    "EXERCISE_PHYSIOLOGIST",
    "HEALTH_WELLNESS_COACH",
    "NUTRITION_COACH",
    "OTHER",
  ] as const;

  const CLINICAL = [
    "MEDICAL_NUTRITION_THERAPY",
    "DIAGNOSE_METABOLIC_DISEASE",
    "PHYSICAL_THERAPY",
    "INJURY_DIAGNOSIS",
    "PSYCHOTHERAPY",
    "MEDICAL_DIAGNOSIS",
  ];

  it.each(UNLICENSED)("%s is never offered a clinical scope", (profession) => {
    const allowed = allowedCapabilities([profession]) as readonly string[];
    for (const clinical of CLINICAL) {
      expect(allowed, `${profession} may select ${clinical}`).not.toContain(clinical);
    }
  });
});

describe("holding several qualifications stays walkable", () => {
  const COMBINATIONS = [
    ["PERSONAL_TRAINER", "NUTRITION_COACH"],
    ["PHYSICAL_THERAPIST", "DIETITIAN_NUTRITIONIST"],
    ["STRENGTH_CONDITIONING_COACH", "EXERCISE_PHYSIOLOGIST"],
    ["PHYSICIAN", "DIETITIAN_NUTRITIONIST"],
  ] as const;

  it.each(COMBINATIONS.map((c) => [c.join(" + "), c] as const))(
    "%s can still complete step 5",
    (_name, professions) => {
      const allowed = allowedCapabilities(professions);
      const populations = allowed.filter((c) =>
        (CLIENT_POPULATIONS as readonly string[]).includes(c),
      );
      const dexa = allowed.filter((c) =>
        (DEXA_CAPABILITIES as readonly string[]).includes(c),
      );
      expect(populations.length).toBeGreaterThan(0);
      expect(dexa.length).toBeGreaterThan(0);
    },
  );

  it.each(COMBINATIONS.map((c) => [c.join(" + "), c] as const))(
    "%s gives every requirement a distinct key",
    (_name, professions) => {
      const requirements = getRequirements(professions, "MA");
      const keys = requirements.credentials.map((c) => c.key);
      // A duplicate key would let one uploaded document satisfy two different
      // requirements, which is exactly the collision the key exists to prevent.
      expect(new Set(keys).size).toBe(keys.length);
      for (const requirement of requirements.credentials) {
        expect(requirement.key, "requirement has no key").toBeTruthy();
      }
    },
  );
});
