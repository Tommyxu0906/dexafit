import type { ProfessionType } from "./enums";

export const CLIENT_POPULATIONS = [
  "GENERAL_WELLNESS",
  "BODY_RECOMPOSITION",
  "WEIGHT_MANAGEMENT",
  "MUSCLE_GAIN",
  "ATHLETES",
  "OLDER_ADULTS",
  "WOMENS_HEALTH",
  "MENS_HEALTH",
  "POST_INJURY",
  "BONE_HEALTH",
  "METABOLIC_HEALTH",
  "PERFORMANCE",
  "BEGINNERS",
] as const;

export type ClientPopulation = (typeof CLIENT_POPULATIONS)[number];

export const DEXA_CAPABILITIES = [
  "HIGH_BODY_FAT",
  "LOW_LEAN_MASS",
  "LOW_ALMI",
  "LOW_FFMI",
  "ELEVATED_VISCERAL_FAT",
  "ELEVATED_ANDROID_GYNOID_RATIO",
  "LEAN_MASS_ASYMMETRY",
  "MOBILITY_LIMITATION",
  "POST_REHAB_STRENGTH",
  "DEXA_BONE_HEALTH",
  "LOW_BMD_INDICATOR",
  "DEXA_BODY_RECOMPOSITION",
  "DEXA_MUSCLE_GAIN",
  "FAT_LOSS",
  "SPORTS_PERFORMANCE",
  "GENERAL_LONGEVITY",
] as const;

export type DexaCapability = (typeof DEXA_CAPABILITIES)[number];

/**
 * Clinical scopes. These are never offered to unlicensed professions — not as a
 * disabled checkbox, not at all — and are rejected server-side if submitted.
 */
export const CLINICAL_CAPABILITIES = [
  "MEDICAL_NUTRITION_THERAPY",
  "DIAGNOSE_METABOLIC_DISEASE",
  "PHYSICAL_THERAPY",
  "INJURY_DIAGNOSIS",
  "PSYCHOTHERAPY",
  "MEDICAL_DIAGNOSIS",
] as const;

export type ClinicalCapability = (typeof CLINICAL_CAPABILITIES)[number];

export type CapabilityCode =
  | ClientPopulation
  | DexaCapability
  | ClinicalCapability;

export const CAPABILITY_LABELS: Record<CapabilityCode, string> = {
  GENERAL_WELLNESS: "General wellness",
  BODY_RECOMPOSITION: "Body recomposition",
  WEIGHT_MANAGEMENT: "Weight management",
  MUSCLE_GAIN: "Muscle gain",
  ATHLETES: "Athletes",
  OLDER_ADULTS: "Older adults",
  WOMENS_HEALTH: "Women's health",
  MENS_HEALTH: "Men's health",
  POST_INJURY: "Post-injury",
  BONE_HEALTH: "Bone health",
  METABOLIC_HEALTH: "Metabolic health",
  PERFORMANCE: "Performance",
  BEGINNERS: "Beginners",

  HIGH_BODY_FAT: "High body fat",
  LOW_LEAN_MASS: "Low lean mass",
  LOW_ALMI: "Low ALMI",
  LOW_FFMI: "Low FFMI",
  ELEVATED_VISCERAL_FAT: "Elevated visceral fat",
  ELEVATED_ANDROID_GYNOID_RATIO: "Elevated android/gynoid ratio",
  LEAN_MASS_ASYMMETRY: "Lean mass asymmetry",
  MOBILITY_LIMITATION: "Mobility limitation",
  POST_REHAB_STRENGTH: "Post-rehab strength",
  DEXA_BONE_HEALTH: "Bone health",
  LOW_BMD_INDICATOR: "Low BMD indicator",
  DEXA_BODY_RECOMPOSITION: "Body recomposition",
  DEXA_MUSCLE_GAIN: "Muscle gain",
  FAT_LOSS: "Fat loss",
  SPORTS_PERFORMANCE: "Sports performance",
  GENERAL_LONGEVITY: "General longevity",

  MEDICAL_NUTRITION_THERAPY: "Medical nutrition therapy",
  DIAGNOSE_METABOLIC_DISEASE: "Diagnose metabolic disease",
  PHYSICAL_THERAPY: "Physical therapy",
  INJURY_DIAGNOSIS: "Injury diagnosis",
  PSYCHOTHERAPY: "Psychotherapy",
  MEDICAL_DIAGNOSIS: "Medical diagnosis",
};

const FITNESS_SCOPE: readonly CapabilityCode[] = [
  "GENERAL_WELLNESS",
  "BODY_RECOMPOSITION",
  "WEIGHT_MANAGEMENT",
  "MUSCLE_GAIN",
  "ATHLETES",
  "OLDER_ADULTS",
  "WOMENS_HEALTH",
  "MENS_HEALTH",
  "PERFORMANCE",
  "BEGINNERS",
  "HIGH_BODY_FAT",
  "LOW_LEAN_MASS",
  "LOW_ALMI",
  "LOW_FFMI",
  "LEAN_MASS_ASYMMETRY",
  "DEXA_BODY_RECOMPOSITION",
  "DEXA_MUSCLE_GAIN",
  "FAT_LOSS",
  "SPORTS_PERFORMANCE",
  "GENERAL_LONGEVITY",
];

const NUTRITION_COACH_SCOPE: readonly CapabilityCode[] = [
  "GENERAL_WELLNESS",
  "WEIGHT_MANAGEMENT",
  "BODY_RECOMPOSITION",
  "MUSCLE_GAIN",
  "BEGINNERS",
  "HIGH_BODY_FAT",
  "FAT_LOSS",
  "DEXA_BODY_RECOMPOSITION",
  "GENERAL_LONGEVITY",
];

const WELLNESS_COACH_SCOPE: readonly CapabilityCode[] = [
  "GENERAL_WELLNESS",
  "WEIGHT_MANAGEMENT",
  "BEGINNERS",
  "OLDER_ADULTS",
  "WOMENS_HEALTH",
  "MENS_HEALTH",
  "GENERAL_LONGEVITY",
];

const CLINICAL_MEDICAL_SCOPE: readonly CapabilityCode[] = [
  ...CLIENT_POPULATIONS,
  ...DEXA_CAPABILITIES,
  "MEDICAL_DIAGNOSIS",
  "DIAGNOSE_METABOLIC_DISEASE",
  "MEDICAL_NUTRITION_THERAPY",
];

const MENTAL_HEALTH_SCOPE: readonly CapabilityCode[] = [
  "GENERAL_WELLNESS",
  "WEIGHT_MANAGEMENT",
  "ATHLETES",
  "OLDER_ADULTS",
  "WOMENS_HEALTH",
  "MENS_HEALTH",
  "BEGINNERS",
  "PSYCHOTHERAPY",
  "GENERAL_LONGEVITY",
];

/**
 * What each profession may claim. Providers cannot be trusted to self-limit, so
 * the allow-list is enforced server-side and drives which options render at all.
 */
export const ALLOWED_CAPABILITIES_BY_PROFESSION: Record<
  ProfessionType,
  readonly CapabilityCode[]
> = {
  PERSONAL_TRAINER: FITNESS_SCOPE,
  STRENGTH_CONDITIONING_COACH: FITNESS_SCOPE,
  SPORTS_PERFORMANCE_COACH: FITNESS_SCOPE,
  HEALTH_WELLNESS_COACH: WELLNESS_COACH_SCOPE,
  NUTRITION_COACH: NUTRITION_COACH_SCOPE,

  DIETITIAN_NUTRITIONIST: [
    ...CLIENT_POPULATIONS,
    "HIGH_BODY_FAT",
    "LOW_LEAN_MASS",
    "LOW_ALMI",
    "LOW_FFMI",
    "ELEVATED_VISCERAL_FAT",
    "ELEVATED_ANDROID_GYNOID_RATIO",
    "DEXA_BONE_HEALTH",
    "DEXA_BODY_RECOMPOSITION",
    "DEXA_MUSCLE_GAIN",
    "FAT_LOSS",
    "GENERAL_LONGEVITY",
    "MEDICAL_NUTRITION_THERAPY",
  ],

  PHYSICAL_THERAPIST: [
    ...CLIENT_POPULATIONS,
    "LOW_LEAN_MASS",
    "LOW_ALMI",
    "LOW_FFMI",
    "LEAN_MASS_ASYMMETRY",
    "MOBILITY_LIMITATION",
    "POST_REHAB_STRENGTH",
    "DEXA_BONE_HEALTH",
    "LOW_BMD_INDICATOR",
    "SPORTS_PERFORMANCE",
    "GENERAL_LONGEVITY",
    "PHYSICAL_THERAPY",
  ],

  ATHLETIC_TRAINER: [
    ...FITNESS_SCOPE,
    "POST_INJURY",
    "MOBILITY_LIMITATION",
    "POST_REHAB_STRENGTH",
  ],

  LMHC: MENTAL_HEALTH_SCOPE,
  LSMHC: MENTAL_HEALTH_SCOPE,
  LMFT: MENTAL_HEALTH_SCOPE,
  LICSW: MENTAL_HEALTH_SCOPE,
  LCSW: MENTAL_HEALTH_SCOPE,
  PSYCHOLOGIST: MENTAL_HEALTH_SCOPE,

  PHYSICIAN: [...CLINICAL_MEDICAL_SCOPE, "INJURY_DIAGNOSIS"],
  NURSE_PRACTITIONER: CLINICAL_MEDICAL_SCOPE,
  PHYSICIAN_ASSISTANT: CLINICAL_MEDICAL_SCOPE,

  OTHER: ["GENERAL_WELLNESS"],
};

export function allowedCapabilities(
  professionType: ProfessionType,
): readonly CapabilityCode[] {
  return ALLOWED_CAPABILITIES_BY_PROFESSION[professionType] ?? [];
}

export function isCapabilityAllowed(
  professionType: ProfessionType,
  code: string,
): boolean {
  return (allowedCapabilities(professionType) as readonly string[]).includes(code);
}

/** Drop anything outside scope. Applied server-side before any write. */
export function filterAllowedCapabilities(
  professionType: ProfessionType,
  codes: string[],
): CapabilityCode[] {
  return codes.filter((c) =>
    isCapabilityAllowed(professionType, c),
  ) as CapabilityCode[];
}
