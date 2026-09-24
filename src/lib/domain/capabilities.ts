import type { ProfessionType } from "./enums";

/**
 * What a provider can be matched on.
 *
 * Two independent axes, and keeping them independent is the whole point:
 *
 *   CLIENT_POPULATIONS   who they work with, and what those people are after
 *   ASSESSMENT_FINDINGS  which measured results they are equipped to act on
 *
 * These used to overlap — "Body recomposition" and "Muscle gain" appeared in
 * both lists, the second copy carrying a DEXA_ prefix purely to dodge the key
 * collision — so the form asked the same question twice and the answers meant
 * nothing different. Goals belong to the population axis; only things DexaFit
 * actually measures belong to the findings axis.
 *
 * DexaFit is not only a DEXA scanner. The tests are DEXA (body composition,
 * visceral fat, bone density), VO2 max (cardiorespiratory fitness, heart-rate
 * zones) and RMR (metabolic rate, fuel utilisation), plus biological age across
 * them. Findings are grouped by the test that produces them so a provider is
 * choosing against something real rather than a flat list of jargon.
 */

export const CLIENT_POPULATIONS = [
  "GENERAL_WELLNESS",
  "BEGINNERS",
  "WEIGHT_MANAGEMENT",
  // DexaFit markets to this group directly: on a GLP-1 as much as 30% of the
  // weight lost can be lean mass, which is exactly what a scan catches. It is a
  // distinct population, not a flavour of weight management.
  "GLP1_SUPPORT",
  "BODY_RECOMPOSITION",
  "MUSCLE_GAIN",
  "ATHLETES",
  "OLDER_ADULTS",
  "LONGEVITY",
  "WOMENS_HEALTH",
  "MENS_HEALTH",
  "METABOLIC_HEALTH",
  "BONE_HEALTH",
  "POST_INJURY",
  "MOBILITY_LIMITATION",
] as const;

export type ClientPopulation = (typeof CLIENT_POPULATIONS)[number];

/** Which DexaFit test produces a finding. Drives the grouping on the form. */
export const ASSESSMENT_GROUPS = [
  "BODY_COMPOSITION",
  "BONE_DENSITY",
  "CARDIORESPIRATORY",
  "METABOLIC",
  "OVERALL",
] as const;

export type AssessmentGroup = (typeof ASSESSMENT_GROUPS)[number];

export const ASSESSMENT_GROUP_LABELS: Record<AssessmentGroup, string> = {
  BODY_COMPOSITION: "Body composition (DEXA scan)",
  BONE_DENSITY: "Bone density (DEXA scan)",
  CARDIORESPIRATORY: "Cardiorespiratory fitness (VO\u2082 max test)",
  METABOLIC: "Metabolic rate (RMR test)",
  OVERALL: "Across the whole assessment",
};

export const ASSESSMENT_FINDINGS = [
  "HIGH_BODY_FAT",
  "ELEVATED_VISCERAL_FAT",
  "LOW_LEAN_MASS",
  "LOW_ALMI",
  "LOW_FFMI",
  "ELEVATED_ANDROID_GYNOID_RATIO",
  "LEAN_MASS_ASYMMETRY",
  "LOW_BMD_INDICATOR",
  "LOW_VO2_MAX",
  "HEART_RATE_ZONES",
  "LOW_RMR",
  "RMR_CALORIE_TARGETS",
  "SUBSTRATE_UTILIZATION",
  "ELEVATED_BIOLOGICAL_AGE",
] as const;

export type AssessmentFinding = (typeof ASSESSMENT_FINDINGS)[number];

export const FINDING_GROUP: Record<AssessmentFinding, AssessmentGroup> = {
  HIGH_BODY_FAT: "BODY_COMPOSITION",
  ELEVATED_VISCERAL_FAT: "BODY_COMPOSITION",
  LOW_LEAN_MASS: "BODY_COMPOSITION",
  LOW_ALMI: "BODY_COMPOSITION",
  LOW_FFMI: "BODY_COMPOSITION",
  ELEVATED_ANDROID_GYNOID_RATIO: "BODY_COMPOSITION",
  LEAN_MASS_ASYMMETRY: "BODY_COMPOSITION",
  LOW_BMD_INDICATOR: "BONE_DENSITY",
  LOW_VO2_MAX: "CARDIORESPIRATORY",
  HEART_RATE_ZONES: "CARDIORESPIRATORY",
  LOW_RMR: "METABOLIC",
  RMR_CALORIE_TARGETS: "METABOLIC",
  SUBSTRATE_UTILIZATION: "METABOLIC",
  ELEVATED_BIOLOGICAL_AGE: "OVERALL",
};

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
  | AssessmentFinding
  | ClinicalCapability;

export const CAPABILITY_LABELS: Record<CapabilityCode, string> = {
  GENERAL_WELLNESS: "General wellness",
  BEGINNERS: "Just getting started",
  WEIGHT_MANAGEMENT: "Weight loss",
  GLP1_SUPPORT: "Weight-loss medication (GLP-1) clients",
  BODY_RECOMPOSITION: "Body recomposition",
  MUSCLE_GAIN: "Muscle gain",
  ATHLETES: "Athletes & performance",
  OLDER_ADULTS: "Older adults",
  LONGEVITY: "Longevity & healthy aging",
  WOMENS_HEALTH: "Women's health",
  MENS_HEALTH: "Men's health",
  METABOLIC_HEALTH: "Metabolic health",
  BONE_HEALTH: "Bone health",
  POST_INJURY: "Post-injury & return to activity",
  MOBILITY_LIMITATION: "Limited mobility",

  HIGH_BODY_FAT: "High body fat percentage",
  ELEVATED_VISCERAL_FAT: "Elevated visceral fat",
  LOW_LEAN_MASS: "Low lean mass",
  LOW_ALMI: "Low ALMI (appendicular lean mass index)",
  LOW_FFMI: "Low FFMI (fat-free mass index)",
  ELEVATED_ANDROID_GYNOID_RATIO: "Elevated android/gynoid ratio",
  LEAN_MASS_ASYMMETRY: "Left/right lean mass asymmetry",
  LOW_BMD_INDICATOR: "Low bone density (low T-score)",
  LOW_VO2_MAX: "Low VO\u2082 max for age and sex",
  HEART_RATE_ZONES: "Heart-rate zone / Zone 2 programming",
  LOW_RMR: "Lower-than-predicted metabolic rate",
  RMR_CALORIE_TARGETS: "Calorie targets from measured RMR",
  SUBSTRATE_UTILIZATION: "Fuel utilisation (fat vs carbohydrate)",
  ELEVATED_BIOLOGICAL_AGE: "Biological age older than chronological",

  MEDICAL_NUTRITION_THERAPY: "Medical nutrition therapy",
  DIAGNOSE_METABOLIC_DISEASE: "Diagnose metabolic disease",
  PHYSICAL_THERAPY: "Physical therapy",
  INJURY_DIAGNOSIS: "Injury diagnosis",
  PSYCHOTHERAPY: "Psychotherapy",
  MEDICAL_DIAGNOSIS: "Medical diagnosis",
};

const FITNESS_SCOPE: readonly CapabilityCode[] = [
  "GENERAL_WELLNESS",
  "BEGINNERS",
  "WEIGHT_MANAGEMENT",
  "GLP1_SUPPORT",
  "BODY_RECOMPOSITION",
  "MUSCLE_GAIN",
  "ATHLETES",
  "OLDER_ADULTS",
  "WOMENS_HEALTH",
  "MENS_HEALTH",
  "LONGEVITY",
  "HIGH_BODY_FAT",
  "ELEVATED_VISCERAL_FAT",
  "LOW_LEAN_MASS",
  "LOW_ALMI",
  "LOW_FFMI",
  "LEAN_MASS_ASYMMETRY",
  // A trainer reads a VO2 max result to set training zones. Nothing about that
  // is diagnostic, and it is the second most common thing DexaFit measures.
  "LOW_VO2_MAX",
  "HEART_RATE_ZONES",
  // Using a measured RMR to set calorie targets is coaching. Diagnosing why the
  // number is low is not, and stays out of this scope.
  "RMR_CALORIE_TARGETS",
  "ELEVATED_BIOLOGICAL_AGE",
];

const NUTRITION_COACH_SCOPE: readonly CapabilityCode[] = [
  "GENERAL_WELLNESS",
  "BEGINNERS",
  "WEIGHT_MANAGEMENT",
  "GLP1_SUPPORT",
  "BODY_RECOMPOSITION",
  "MUSCLE_GAIN",
  "LONGEVITY",
  "HIGH_BODY_FAT",
  "ELEVATED_VISCERAL_FAT",
  "RMR_CALORIE_TARGETS",
  "SUBSTRATE_UTILIZATION",
  "ELEVATED_BIOLOGICAL_AGE",
];

const WELLNESS_COACH_SCOPE: readonly CapabilityCode[] = [
  "GENERAL_WELLNESS",
  "BEGINNERS",
  "WEIGHT_MANAGEMENT",
  "OLDER_ADULTS",
  "WOMENS_HEALTH",
  "MENS_HEALTH",
  "LONGEVITY",
  "ELEVATED_BIOLOGICAL_AGE",
];

const CLINICAL_MEDICAL_SCOPE: readonly CapabilityCode[] = [
  ...CLIENT_POPULATIONS,
  ...ASSESSMENT_FINDINGS,
  "MEDICAL_DIAGNOSIS",
  "DIAGNOSE_METABOLIC_DISEASE",
  "MEDICAL_NUTRITION_THERAPY",
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

  // Trained for clinical and metabolic populations, which is why this reaches
  // further than the fitness scope — but not into diagnosis.
  EXERCISE_PHYSIOLOGIST: [
    ...FITNESS_SCOPE,
    "METABOLIC_HEALTH",
    "MOBILITY_LIMITATION",
    "POST_INJURY",
    "BONE_HEALTH",
    "LOW_BMD_INDICATOR",
    // The clinical exercise population is exactly where a measured metabolic
    // rate and its fuel split matter most.
    "LOW_RMR",
    "SUBSTRATE_UTILIZATION",
  ],

  HEALTH_WELLNESS_COACH: WELLNESS_COACH_SCOPE,
  NUTRITION_COACH: NUTRITION_COACH_SCOPE,

  DIETITIAN_NUTRITIONIST: [
    ...CLIENT_POPULATIONS,
    "HIGH_BODY_FAT",
    "ELEVATED_VISCERAL_FAT",
    "LOW_LEAN_MASS",
    "LOW_ALMI",
    "LOW_FFMI",
    "ELEVATED_ANDROID_GYNOID_RATIO",
    "LOW_BMD_INDICATOR",
    "LOW_RMR",
    "RMR_CALORIE_TARGETS",
    "SUBSTRATE_UTILIZATION",
    "ELEVATED_BIOLOGICAL_AGE",
    "MEDICAL_NUTRITION_THERAPY",
  ],

  PHYSICAL_THERAPIST: [
    ...CLIENT_POPULATIONS,
    "LOW_LEAN_MASS",
    "LOW_ALMI",
    "LOW_FFMI",
    "LEAN_MASS_ASYMMETRY",
    "LOW_BMD_INDICATOR",
    "LOW_VO2_MAX",
    "HEART_RATE_ZONES",
    "ELEVATED_BIOLOGICAL_AGE",
    "PHYSICAL_THERAPY",
  ],

  ATHLETIC_TRAINER: [...FITNESS_SCOPE, "POST_INJURY", "MOBILITY_LIMITATION"],

  PHYSICIAN: [...CLINICAL_MEDICAL_SCOPE, "INJURY_DIAGNOSIS"],
  NURSE_PRACTITIONER: CLINICAL_MEDICAL_SCOPE,
  PHYSICIAN_ASSISTANT: CLINICAL_MEDICAL_SCOPE,

  // An unrecognised profession is always reviewed by hand, so the scope stays
  // deliberately general — but it still needs one of each kind, or the provider
  // reaches step 5 and cannot satisfy it.
  // Needs at least one of each axis or the provider reaches step 5 and cannot
  // satisfy it. Body fat and biological age are the two findings that need no
  // assumption about what this unrecognised profession actually does.
  OTHER: [
    "GENERAL_WELLNESS",
    "BEGINNERS",
    "LONGEVITY",
    "HIGH_BODY_FAT",
    "ELEVATED_BIOLOGICAL_AGE",
  ],
};

/**
 * What a professional may claim, across every profession they hold.
 *
 * The union is the right operation here: a personal trainer who is also a
 * dietitian may legitimately claim medical nutrition therapy, because the
 * dietitian licence is what permits it. Whether they have actually proven that
 * licence is a separate question, answered by the readiness engine.
 */
export function allowedCapabilities(
  professionTypes: readonly ProfessionType[],
): readonly CapabilityCode[] {
  const allowed = new Set<CapabilityCode>();
  for (const professionType of professionTypes) {
    for (const code of ALLOWED_CAPABILITIES_BY_PROFESSION[professionType] ?? []) {
      allowed.add(code);
    }
  }
  return [...allowed];
}

export function isCapabilityAllowed(
  professionTypes: readonly ProfessionType[],
  code: string,
): boolean {
  return (allowedCapabilities(professionTypes) as readonly string[]).includes(code);
}

/** Drop anything outside scope. Applied server-side before any write. */
export function filterAllowedCapabilities(
  professionTypes: readonly ProfessionType[],
  codes: string[],
): CapabilityCode[] {
  return codes.filter((c) =>
    isCapabilityAllowed(professionTypes, c),
  ) as CapabilityCode[];
}
