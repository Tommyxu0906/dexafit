import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_FINDINGS,
  CAPABILITY_LABELS,
  CLIENT_POPULATIONS,
  FINDING_GROUP,
  allowedCapabilities,
  filterAllowedCapabilities,
  isCapabilityAllowed,
} from "../capabilities";
import { PROFESSION_TYPES } from "../enums";

describe("capability scope enforcement", () => {
  it("lets a personal trainer claim training-related findings", () => {
    for (const code of [
      "LOW_LEAN_MASS",
      "HIGH_BODY_FAT",
      "LEAN_MASS_ASYMMETRY",
      // DexaFit measures more than body composition, and reading a VO2 max
      // result to set training zones is squarely a trainer's job.
      "LOW_VO2_MAX",
      "HEART_RATE_ZONES",
      "RMR_CALORIE_TARGETS",
    ]) {
      expect(isCapabilityAllowed(["PERSONAL_TRAINER"], code), code).toBe(true);
    }
  });

  it("keeps a trainer out of interpreting why a metabolic rate is low", () => {
    // Setting calorie targets from a measured RMR is coaching. Deciding that
    // the number is low for a clinical reason is not.
    expect(isCapabilityAllowed(["PERSONAL_TRAINER"], "LOW_RMR")).toBe(false);
    expect(isCapabilityAllowed(["PERSONAL_TRAINER"], "MEDICAL_NUTRITION_THERAPY")).toBe(
      false,
    );
  });

  it("never offers clinical scopes to a personal trainer", () => {
    for (const code of [
      "PHYSICAL_THERAPY",
      "INJURY_DIAGNOSIS",
      "PSYCHOTHERAPY",
      "MEDICAL_DIAGNOSIS",
      "MEDICAL_NUTRITION_THERAPY",
    ]) {
      expect(isCapabilityAllowed(["PERSONAL_TRAINER"], code)).toBe(false);
    }
  });

  it("never offers medical nutrition therapy or disease diagnosis to a nutrition coach", () => {
    expect(isCapabilityAllowed(["NUTRITION_COACH"], "MEDICAL_NUTRITION_THERAPY")).toBe(
      false,
    );
    expect(isCapabilityAllowed(["NUTRITION_COACH"], "DIAGNOSE_METABOLIC_DISEASE")).toBe(
      false,
    );
  });

  it("allows medical nutrition therapy for a licensed dietitian", () => {
    expect(
      isCapabilityAllowed(["DIETITIAN_NUTRITIONIST"], "MEDICAL_NUTRITION_THERAPY"),
    ).toBe(true);
  });

  it("allows physical therapy only for a physical therapist", () => {
    expect(isCapabilityAllowed(["PHYSICAL_THERAPIST"], "PHYSICAL_THERAPY")).toBe(true);
    expect(isCapabilityAllowed(["ATHLETIC_TRAINER"], "PHYSICAL_THERAPY")).toBe(false);
    expect(isCapabilityAllowed(["HEALTH_WELLNESS_COACH"], "PHYSICAL_THERAPY")).toBe(false);
  });

  it("strips out-of-scope codes submitted by a client", () => {
    const filtered = filterAllowedCapabilities(["PERSONAL_TRAINER"], [
      "MUSCLE_GAIN",
      "PSYCHOTHERAPY",
      "MEDICAL_DIAGNOSIS",
      "HIGH_BODY_FAT",
    ]);
    expect(filtered).toEqual(["MUSCLE_GAIN", "HIGH_BODY_FAT"]);
  });

  it("defines an allow-list for every profession", () => {
    for (const profession of PROFESSION_TYPES) {
      expect(allowedCapabilities([profession]).length).toBeGreaterThan(0);
    }
  });

  it("gives a professional the union of what each qualification permits", () => {
    // A trainer who is also a dietitian may claim medical nutrition therapy,
    // because the dietitian licence is what permits it.
    expect(isCapabilityAllowed(["PERSONAL_TRAINER"], "MEDICAL_NUTRITION_THERAPY")).toBe(
      false,
    );
    expect(
      isCapabilityAllowed(
        ["PERSONAL_TRAINER", "DIETITIAN_NUTRITIONIST"],
        "MEDICAL_NUTRITION_THERAPY",
      ),
    ).toBe(true);
  });

  it("still refuses anything no held qualification permits", () => {
    expect(
      isCapabilityAllowed(
        ["PERSONAL_TRAINER", "NUTRITION_COACH", "HEALTH_WELLNESS_COACH"],
        "MEDICAL_DIAGNOSIS",
      ),
    ).toBe(false);
  });
});

describe("the two axes stay separate", () => {
  // The bug this prevents: "Body recomposition" and "Muscle gain" were client
  // populations AND assessment findings, the second copy carrying a DEXA_
  // prefix invented only to dodge the key collision. The form rendered each
  // twice and the two answers meant nothing different.
  it("never shows the same label on both lists", () => {
    const seen = new Map<string, string>();
    for (const code of [...CLIENT_POPULATIONS, ...ASSESSMENT_FINDINGS]) {
      const label = CAPABILITY_LABELS[code];
      const previous = seen.get(label);
      expect(previous, `"${label}" is both ${previous} and ${code}`).toBeUndefined();
      seen.set(label, code);
    }
  });

  it("keeps goals off the findings list", () => {
    // A finding is something DexaFit measured. "Fat loss" and "Sports
    // performance" are what the client wants, which is the other question.
    for (const code of ASSESSMENT_FINDINGS) {
      expect(
        (CLIENT_POPULATIONS as readonly string[]).includes(code),
        `${code} is on both axes`,
      ).toBe(false);
    }
  });
});

describe("findings cover what DexaFit actually measures", () => {
  it("files every finding under the test that produces it", () => {
    for (const code of ASSESSMENT_FINDINGS) {
      expect(FINDING_GROUP[code], `${code} has no assessment group`).toBeDefined();
    }
  });

  it("covers VO2 max and RMR, not only the DEXA scan", () => {
    // DexaFit runs three tests. Modelling only the scan meant a provider could
    // not say they read a VO2 max or set targets from a measured RMR.
    const groups = new Set(ASSESSMENT_FINDINGS.map((c) => FINDING_GROUP[c]));
    for (const group of ["BODY_COMPOSITION", "BONE_DENSITY", "CARDIORESPIRATORY", "METABOLIC"] as const) {
      expect(groups.has(group), `nothing covers ${group}`).toBe(true);
    }
  });
});

describe("every profession can finish step 5", () => {
  // Step 5 requires at least one client population and at least one finding.
  // A profession scoped to neither strands the provider on a page they cannot
  // complete — which is exactly what happened to OTHER when longevity moved
  // from the findings axis to the populations axis.
  it.each(PROFESSION_TYPES)("%s has at least one of each", (profession) => {
    const allowed = new Set(allowedCapabilities([profession]));
    expect(
      CLIENT_POPULATIONS.some((c) => allowed.has(c)),
      `${profession} has no selectable client population`,
    ).toBe(true);
    expect(
      ASSESSMENT_FINDINGS.some((c) => allowed.has(c)),
      `${profession} has no selectable assessment finding`,
    ).toBe(true);
  });
});
