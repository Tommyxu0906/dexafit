import { describe, expect, it } from "vitest";
import { ONBOARDING_STEPS, STEP_SLUGS, nextStep } from "../steps";
import { ATTESTATION_TEXT, ATTESTATION_TYPES } from "../attestations";
import {
  CLIENT_POPULATIONS,
  ASSESSMENT_FINDINGS,
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
      (ASSESSMENT_FINDINGS as readonly string[]).includes(c),
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
        (ASSESSMENT_FINDINGS as readonly string[]).includes(c),
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

describe("the wizard only asks credentialing questions", () => {
  // Products and a second address left the wizard. The chain has to stay
  // connected, or a provider walks into a step that no longer exists.
  it("runs from about to review with no dangling step", () => {
    expect(STEP_SLUGS[0]).toBe("about");
    expect(STEP_SLUGS[STEP_SLUGS.length - 1]).toBe("review");

    for (let i = 0; i < STEP_SLUGS.length - 1; i += 1) {
      expect(nextStep(STEP_SLUGS[i]), `${STEP_SLUGS[i]} leads nowhere`).toBe(
        STEP_SLUGS[i + 1],
      );
    }
    expect(nextStep("review")).toBeNull();
  });

  it("no longer asks for products or a second address", () => {
    // Either one reappearing means onboarding grew a question that does not
    // decide whether someone can be credentialed.
    expect(STEP_SLUGS).not.toContain("services");
    expect(STEP_SLUGS).not.toContain("locations");
  });

  it("numbers the steps consecutively from one", () => {
    // The index is what the sidebar renders; a gap shows up as "step 7 of 7"
    // sitting under step 5.
    ONBOARDING_STEPS.forEach((step, i) => {
      expect(step.index, `${step.slug} is numbered ${step.index}`).toBe(i + 1);
    });
  });
});

describe("the attestations a provider signs", () => {
  it("records that they practise independently of DexaFit", () => {
    // The point is liability separation, so the wording has to actually say
    // they are not an employee and are responsible for their own services.
    const text = ATTESTATION_TEXT.INDEPENDENT_PRACTICE.toLowerCase();
    expect(text).toContain("not an employee");
    expect(text).toContain("solely responsible");
  });

  it("gets consent before DexaFit edits anyone's copy", () => {
    const text = ATTESTATION_TEXT.PROFILE_CONTENT_EDITING.toLowerCase();
    expect(text).toContain("edit");
    // Editing for tone is not licence to change what they claim to offer.
    expect(text).toContain("without changing the substance");
  });

  it("still flags every clause that legal has not settled", () => {
    // Inventing final legal wording is not ours to do. These two carry real
    // exposure, so they stay marked until a lawyer signs them off.
    for (const type of ["INDEPENDENT_PRACTICE", "MARKETPLACE_TERMS"] as const) {
      expect(ATTESTATION_TEXT[type], type).toContain("PLACEHOLDER");
    }
  });

  it("asks for every attestation on the list", () => {
    for (const type of ATTESTATION_TYPES) {
      expect(ATTESTATION_TEXT[type], `${type} has no text`).toBeTruthy();
    }
  });
});
