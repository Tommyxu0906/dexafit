import { describe, expect, it } from "vitest";
import {
  allowedCapabilities,
  filterAllowedCapabilities,
  isCapabilityAllowed,
} from "../capabilities";
import { PROFESSION_TYPES } from "../enums";

describe("capability scope enforcement", () => {
  it("lets a personal trainer claim training-related DEXA capabilities", () => {
    for (const code of [
      "LOW_LEAN_MASS",
      "DEXA_BODY_RECOMPOSITION",
      "DEXA_MUSCLE_GAIN",
      "FAT_LOSS",
      "SPORTS_PERFORMANCE",
    ]) {
      expect(isCapabilityAllowed("PERSONAL_TRAINER", code)).toBe(true);
    }
  });

  it("never offers clinical scopes to a personal trainer", () => {
    for (const code of [
      "PHYSICAL_THERAPY",
      "INJURY_DIAGNOSIS",
      "PSYCHOTHERAPY",
      "MEDICAL_DIAGNOSIS",
      "MEDICAL_NUTRITION_THERAPY",
    ]) {
      expect(isCapabilityAllowed("PERSONAL_TRAINER", code)).toBe(false);
    }
  });

  it("never offers medical nutrition therapy or disease diagnosis to a nutrition coach", () => {
    expect(isCapabilityAllowed("NUTRITION_COACH", "MEDICAL_NUTRITION_THERAPY")).toBe(
      false,
    );
    expect(isCapabilityAllowed("NUTRITION_COACH", "DIAGNOSE_METABOLIC_DISEASE")).toBe(
      false,
    );
  });

  it("allows medical nutrition therapy for a licensed dietitian", () => {
    expect(
      isCapabilityAllowed("DIETITIAN_NUTRITIONIST", "MEDICAL_NUTRITION_THERAPY"),
    ).toBe(true);
  });

  it("allows physical therapy only for a physical therapist", () => {
    expect(isCapabilityAllowed("PHYSICAL_THERAPIST", "PHYSICAL_THERAPY")).toBe(true);
    expect(isCapabilityAllowed("ATHLETIC_TRAINER", "PHYSICAL_THERAPY")).toBe(false);
    expect(isCapabilityAllowed("HEALTH_WELLNESS_COACH", "PHYSICAL_THERAPY")).toBe(false);
  });

  it("strips out-of-scope codes submitted by a client", () => {
    const filtered = filterAllowedCapabilities("PERSONAL_TRAINER", [
      "MUSCLE_GAIN",
      "PSYCHOTHERAPY",
      "MEDICAL_DIAGNOSIS",
      "FAT_LOSS",
    ]);
    expect(filtered).toEqual(["MUSCLE_GAIN", "FAT_LOSS"]);
  });

  it("defines an allow-list for every profession", () => {
    for (const profession of PROFESSION_TYPES) {
      expect(allowedCapabilities(profession).length).toBeGreaterThan(0);
    }
  });
});
