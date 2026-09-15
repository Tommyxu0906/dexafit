import type { AprnCategory, CredentialType, ProfessionType } from "./enums";

/**
 * Credentialing rules live here and only here. Profession conditionals must not
 * be re-derived in UI or route code — call `getRequirements()` instead.
 *
 * A requirement carries two independent flags that must never be collapsed:
 *
 *   legalRequirement       — the jurisdiction's licensing law requires it
 *   marketplaceRequirement — DexaFit policy requires it to list
 *
 * A personal trainer's national certification is a marketplace requirement, not
 * a Massachusetts license, and the UI copy must not imply otherwise.
 */
export type CredentialRequirement = {
  credentialType: CredentialType;
  /** Provider-facing label. Never phrase a marketplace rule as a state license. */
  label: string;
  required: boolean;
  legalRequirement: boolean;
  marketplaceRequirement: boolean;
  /** Credential must carry the jurisdiction it was issued in. */
  requiresJurisdiction?: boolean;
  requiresNumber?: boolean;
  requiresExpiration?: boolean;
  requiresDocument?: boolean;
  helpText?: string;
  exampleIssuers?: readonly string[];
  /**
   * When true, a missing credential routes to human review instead of blocking
   * submission outright.
   */
  manualReviewIfMissing?: boolean;
};

/** Extra profession-specific questions rendered on the credentials step. */
export type ExtraQuestion =
  | "RD_RDN"
  | "HSP"
  | "APRN_CATEGORY"
  | "SUPERVISOR"
  | "SUPERVISING_ORGANIZATION";

export type ProfessionRequirements = {
  professionType: ProfessionType;
  credentials: readonly CredentialRequirement[];
  insuranceRequired: boolean;
  /**
   * Whether this profession may be listed as an independent practitioner at all.
   * False here is a hard product rule (LSMHC, LCSW), not an admin judgment call.
   */
  independentListingAllowed: boolean;
  /** Always route to a human, regardless of credential completeness. */
  manualReviewRequired: boolean;
  extraQuestions: readonly ExtraQuestion[];
  /** Shown to the provider and carried into admin review. */
  restrictionNotice?: string;
  /** Scope-sensitive categories must acknowledge their limits explicitly. */
  scopeAcknowledgement?: string;
  /** True once we have researched this profession's rules in a jurisdiction. */
  jurisdictionResearched: boolean;
};

const CPR_AED: CredentialRequirement = {
  credentialType: "CPR_AED",
  label: "CPR/AED certification",
  required: true,
  legalRequirement: false,
  marketplaceRequirement: true,
  requiresExpiration: true,
  requiresDocument: true,
  helpText: "Required by DexaFit marketplace policy.",
};

const NPI_OPTIONAL: CredentialRequirement = {
  credentialType: "NPI",
  label: "NPI number",
  required: false,
  legalRequirement: false,
  marketplaceRequirement: false,
  requiresNumber: true,
};

const BOARD_CERT_OPTIONAL: CredentialRequirement = {
  credentialType: "BOARD_CERTIFICATION",
  label: "Board / specialty certification",
  required: false,
  legalRequirement: false,
  marketplaceRequirement: false,
  requiresDocument: true,
};

function stateLicense(
  label: string,
  overrides: Partial<CredentialRequirement> = {},
): CredentialRequirement {
  return {
    credentialType: "STATE_LICENSE",
    label,
    required: true,
    legalRequirement: true,
    marketplaceRequirement: true,
    requiresJurisdiction: true,
    requiresNumber: true,
    requiresExpiration: true,
    requiresDocument: true,
    ...overrides,
  };
}

function nationalCertification(
  label: string,
  exampleIssuers: readonly string[],
  overrides: Partial<CredentialRequirement> = {},
): CredentialRequirement {
  return {
    credentialType: "NATIONAL_CERTIFICATION",
    label,
    required: true,
    legalRequirement: false,
    marketplaceRequirement: true,
    requiresNumber: true,
    requiresExpiration: true,
    requiresDocument: true,
    exampleIssuers,
    helpText:
      "This is a DexaFit marketplace credentialing requirement, not a state license.",
    ...overrides,
  };
}

const FITNESS_CERT_ISSUERS = [
  "NASM",
  "ACSM",
  "ACE",
  "NSCA",
  "CSCS",
  "ISSA",
  "Other",
] as const;

/**
 * Base rules. Jurisdiction-specific labeling is layered on in `getRequirements`.
 */
const BASE_REQUIREMENTS: Record<ProfessionType, ProfessionRequirements> = {
  PERSONAL_TRAINER: {
    professionType: "PERSONAL_TRAINER",
    credentials: [
      nationalCertification("National fitness certification", FITNESS_CERT_ISSUERS),
      CPR_AED,
    ],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: [],
    jurisdictionResearched: true,
  },

  STRENGTH_CONDITIONING_COACH: {
    professionType: "STRENGTH_CONDITIONING_COACH",
    credentials: [
      nationalCertification(
        "National strength & conditioning certification",
        FITNESS_CERT_ISSUERS,
      ),
      CPR_AED,
    ],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: [],
    jurisdictionResearched: true,
  },

  SPORTS_PERFORMANCE_COACH: {
    professionType: "SPORTS_PERFORMANCE_COACH",
    credentials: [
      nationalCertification(
        "Relevant national certification",
        FITNESS_CERT_ISSUERS,
        {
          // No recognized certification routes to a human rather than auto-approving.
          manualReviewIfMissing: true,
        },
      ),
      CPR_AED,
    ],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: [],
    jurisdictionResearched: true,
  },

  HEALTH_WELLNESS_COACH: {
    professionType: "HEALTH_WELLNESS_COACH",
    credentials: [
      nationalCertification(
        "Health / wellness coaching certification",
        ["NBHWC", "ACE", "ACSM", "Other"],
        { manualReviewIfMissing: true },
      ),
    ],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: [],
    scopeAcknowledgement:
      "I understand that this listing does not authorize me to provide medical treatment, psychotherapy, physical therapy, medical nutrition therapy, or medication management.",
    jurisdictionResearched: true,
  },

  NUTRITION_COACH: {
    professionType: "NUTRITION_COACH",
    credentials: [
      nationalCertification(
        "Nutrition coaching certification",
        ["Precision Nutrition", "NASM", "ISSA", "Other"],
        { manualReviewIfMissing: true },
      ),
    ],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: [],
    scopeAcknowledgement:
      "I understand that this listing does not authorize me to represent myself as a licensed dietitian/nutritionist or to provide services outside my lawful scope.",
    jurisdictionResearched: true,
  },

  DIETITIAN_NUTRITIONIST: {
    professionType: "DIETITIAN_NUTRITIONIST",
    credentials: [stateLicense("Dietitian/Nutritionist license")],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    // A state license is not the same credential as RD/RDN registration.
    extraQuestions: ["RD_RDN"],
    jurisdictionResearched: true,
  },

  PHYSICAL_THERAPIST: {
    professionType: "PHYSICAL_THERAPIST",
    credentials: [
      stateLicense("Physical Therapist license"),
      BOARD_CERT_OPTIONAL,
      NPI_OPTIONAL,
    ],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: [],
    jurisdictionResearched: true,
  },

  ATHLETIC_TRAINER: {
    professionType: "ATHLETIC_TRAINER",
    credentials: [
      stateLicense("Athletic Trainer license"),
      {
        credentialType: "NATIONAL_CERTIFICATION",
        label: "BOC certification",
        required: true,
        legalRequirement: false,
        marketplaceRequirement: true,
        requiresNumber: true,
        requiresExpiration: true,
        requiresDocument: true,
        exampleIssuers: ["Board of Certification (BOC)"],
      },
    ],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: [],
    jurisdictionResearched: true,
  },

  LMHC: {
    professionType: "LMHC",
    credentials: [stateLicense("LMHC license")],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: [],
    jurisdictionResearched: true,
  },

  LSMHC: {
    professionType: "LSMHC",
    credentials: [stateLicense("LSMHC license")],
    insuranceRequired: true,
    // Supervised license: never eligible for an independent listing.
    independentListingAllowed: false,
    manualReviewRequired: true,
    extraQuestions: ["SUPERVISOR", "SUPERVISING_ORGANIZATION"],
    restrictionNotice:
      "LSMHC is a supervised license. You cannot be listed as an independent practitioner; your application requires review and supervisor information.",
    jurisdictionResearched: true,
  },

  LMFT: {
    professionType: "LMFT",
    credentials: [stateLicense("LMFT license")],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: [],
    jurisdictionResearched: true,
  },

  LICSW: {
    professionType: "LICSW",
    credentials: [stateLicense("LICSW license")],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: [],
    jurisdictionResearched: true,
  },

  LCSW: {
    professionType: "LCSW",
    credentials: [stateLicense("LCSW license")],
    insuranceRequired: true,
    // LCSW cannot hold an independent clinical private practice; LICSW can.
    independentListingAllowed: false,
    manualReviewRequired: true,
    extraQuestions: ["SUPERVISOR", "SUPERVISING_ORGANIZATION"],
    restrictionNotice:
      "An LCSW cannot be listed for independent clinical private practice. You may later be listed through an employing organization. Your application requires review.",
    jurisdictionResearched: true,
  },

  PSYCHOLOGIST: {
    professionType: "PSYCHOLOGIST",
    credentials: [stateLicense("Psychologist license")],
    insuranceRequired: true,
    // Conditional: independence depends on the HSP answer, resolved at readiness.
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: ["HSP"],
    jurisdictionResearched: true,
  },

  PHYSICIAN: {
    professionType: "PHYSICIAN",
    credentials: [
      stateLicense("Full Physician License"),
      BOARD_CERT_OPTIONAL,
      NPI_OPTIONAL,
    ],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: [],
    jurisdictionResearched: true,
  },

  NURSE_PRACTITIONER: {
    professionType: "NURSE_PRACTITIONER",
    credentials: [
      {
        credentialType: "RN_LICENSE",
        label: "RN license",
        required: true,
        legalRequirement: true,
        marketplaceRequirement: true,
        requiresJurisdiction: true,
        requiresNumber: true,
        requiresExpiration: true,
        requiresDocument: true,
      },
      {
        credentialType: "APRN_AUTHORIZATION",
        label: "APRN authorization",
        required: true,
        legalRequirement: true,
        marketplaceRequirement: true,
        requiresJurisdiction: true,
        requiresNumber: true,
        requiresExpiration: true,
        requiresDocument: true,
      },
      {
        credentialType: "NATIONAL_CERTIFICATION",
        label: "National APRN certification",
        required: true,
        legalRequirement: true,
        marketplaceRequirement: true,
        requiresNumber: true,
        requiresExpiration: true,
        requiresDocument: true,
        helpText:
          "APRN authorization depends on maintaining current national certification.",
      },
      NPI_OPTIONAL,
    ],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: ["APRN_CATEGORY"],
    jurisdictionResearched: true,
  },

  PHYSICIAN_ASSISTANT: {
    professionType: "PHYSICIAN_ASSISTANT",
    credentials: [
      stateLicense("Physician Assistant license"),
      {
        credentialType: "NATIONAL_CERTIFICATION",
        label: "NCCPA certification",
        required: true,
        legalRequirement: true,
        marketplaceRequirement: true,
        requiresNumber: true,
        requiresExpiration: true,
        requiresDocument: true,
        exampleIssuers: ["NCCPA"],
      },
      NPI_OPTIONAL,
    ],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: [],
    jurisdictionResearched: true,
  },

  OTHER: {
    professionType: "OTHER",
    credentials: [
      {
        credentialType: "OTHER",
        label: "Relevant credential",
        required: false,
        legalRequirement: false,
        marketplaceRequirement: true,
        requiresDocument: true,
        manualReviewIfMissing: true,
      },
    ],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: true,
    extraQuestions: [],
    restrictionNotice:
      "Professions outside our standard categories are reviewed individually.",
    jurisdictionResearched: false,
  },
};

/** Jurisdictions whose licensing rules have been researched for v1. */
export const RESEARCHED_JURISDICTIONS = ["MA"] as const;

const JURISDICTION_NAMES: Record<string, string> = {
  MA: "Massachusetts",
};

/**
 * Resolve the credentialing rules for a profession in a jurisdiction.
 *
 * Only Massachusetts is researched for v1. Other states fall back to generic
 * labeling and manual review rather than asserting rules we have not verified —
 * which is what makes adding NY a config change rather than a rewrite.
 */
export function getRequirements(
  professionType: ProfessionType,
  jurisdictionState: string,
): ProfessionRequirements {
  const base = BASE_REQUIREMENTS[professionType];
  const researched = (RESEARCHED_JURISDICTIONS as readonly string[]).includes(
    jurisdictionState,
  );

  if (!researched) {
    return {
      ...base,
      manualReviewRequired: true,
      jurisdictionResearched: false,
      restrictionNotice:
        base.restrictionNotice ??
        "DexaFit has not yet completed credentialing rules for this state. Your application will be reviewed manually.",
    };
  }

  const stateName = JURISDICTION_NAMES[jurisdictionState] ?? jurisdictionState;

  return {
    ...base,
    jurisdictionResearched: base.jurisdictionResearched,
    credentials: base.credentials.map((c) =>
      c.credentialType === "STATE_LICENSE" || c.credentialType === "RN_LICENSE" ||
      c.credentialType === "APRN_AUTHORIZATION"
        ? { ...c, label: `${stateName} ${c.label}` }
        : c,
    ),
  };
}

export function getRequiredCredentials(
  professionType: ProfessionType,
  jurisdictionState: string,
): CredentialRequirement[] {
  return getRequirements(professionType, jurisdictionState).credentials.filter(
    (c) => c.required,
  );
}

/** Professions whose listing is gated on an answer rather than a fixed rule. */
export function requiresHspForIndependentListing(
  professionType: ProfessionType,
): boolean {
  return professionType === "PSYCHOLOGIST";
}

export function aprnCategoryRequired(professionType: ProfessionType): boolean {
  return professionType === "NURSE_PRACTITIONER";
}

export const APRN_CATEGORY_LABELS: Record<AprnCategory, string> = {
  CNP: "Certified Nurse Practitioner (CNP)",
  CNM: "Certified Nurse Midwife (CNM)",
  CRNA: "Certified Registered Nurse Anesthetist (CRNA)",
  PCNS: "Psychiatric Clinical Nurse Specialist (PCNS)",
  CNS: "Clinical Nurse Specialist (CNS)",
};
