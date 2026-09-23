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
  /**
   * Stable identity for this requirement, and the value a stored credential
   * records to say which requirement it satisfies.
   *
   * A professional may hold several professions at once, and two of them can
   * demand the same credential *type* while meaning different documents: a
   * physical therapist and a dietitian both need a STATE_LICENSE, and one
   * licence does not satisfy the other. Matching on credentialType alone let a
   * single licence tick both boxes. Profession-specific requirements therefore
   * key as `PROFESSION:CREDENTIAL_TYPE`, while genuinely shared ones (a CPR
   * card, an NPI number) key on the type alone so they are only asked for once.
   */
  key: string;
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
  /**
   * Overrides the "Issuing authority" prompt. A supervision agreement is not
   * issued by anyone — the field holds the clinician who provides direction —
   * and asking for an issuer there reads as a mistake.
   */
  issuerLabel?: string;
  exampleIssuers?: readonly string[];
  /**
   * When true, a missing credential routes to human review instead of blocking
   * submission outright.
   */
  manualReviewIfMissing?: boolean;
};

export type CredentialRequirementSpec = Omit<CredentialRequirement, "key">;

/** Extra profession-specific questions rendered on the credentials step. */
export type ExtraQuestion = "RD_RDN" | "APRN_CATEGORY";

/** Rules for exactly one profession, before aggregation. */
type SingleProfessionRules = {
  professionType: ProfessionType;
  credentials: readonly CredentialRequirementSpec[];
  insuranceRequired: boolean;
  independentListingAllowed: boolean;
  manualReviewRequired: boolean;
  extraQuestions: readonly ExtraQuestion[];
  restrictionNotice?: string;
  scopeAcknowledgement?: string;
  jurisdictionResearched: boolean;
};

/**
 * The rules that apply to a professional, across every profession they hold.
 *
 * Aggregation is always toward the stricter answer: insurance and manual review
 * are required if *any* profession requires them, and independent listing is
 * allowed only if *every* profession allows it. Holding an extra qualification
 * can add obligations but must never remove one.
 */
export type ProfessionRequirements = {
  professionTypes: readonly ProfessionType[];
  credentials: readonly CredentialRequirement[];
  insuranceRequired: boolean;
  /**
   * Whether this professional may be listed independently at all. False is a
   * hard product rule, not an admin judgment call.
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

const CPR_AED: CredentialRequirementSpec = {
  credentialType: "CPR_AED",
  label: "CPR/AED certification",
  required: true,
  legalRequirement: false,
  marketplaceRequirement: true,
  requiresExpiration: true,
  requiresDocument: true,
  helpText: "Required by DexaFit marketplace policy.",
};

const NPI_OPTIONAL: CredentialRequirementSpec = {
  credentialType: "NPI",
  label: "NPI number",
  required: false,
  legalRequirement: false,
  marketplaceRequirement: false,
  requiresNumber: true,
};

const BOARD_CERT_OPTIONAL: CredentialRequirementSpec = {
  credentialType: "BOARD_CERTIFICATION",
  label: "Board / specialty certification",
  required: false,
  legalRequirement: false,
  marketplaceRequirement: false,
  requiresDocument: true,
};

function stateLicense(
  label: string,
  overrides: Partial<CredentialRequirementSpec> = {},
): CredentialRequirementSpec {
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
  overrides: Partial<CredentialRequirementSpec> = {},
): CredentialRequirementSpec {
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
const BASE_RULES: Record<ProfessionType, SingleProfessionRules> = {
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
        "National strength, conditioning or sports performance certification",
        FITNESS_CERT_ISSUERS,
        {
          // This category absorbed the former sports performance coach. That one
          // sent an unrecognised certification to a human rather than blocking
          // submission, and merging must not quietly make those people ineligible.
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

  // Massachusetts does not license exercise physiologists, so the ACSM
  // certification is a DexaFit marketplace requirement and must not be labelled
  // as a state licence.
  EXERCISE_PHYSIOLOGIST: {
    professionType: "EXERCISE_PHYSIOLOGIST",
    credentials: [
      nationalCertification(
        "Exercise physiology certification",
        ["ACSM-EP", "ACSM-CEP", "ASEP", "NSCA", "Other"],
        { manualReviewIfMissing: true },
      ),
      CPR_AED,
      BOARD_CERT_OPTIONAL,
    ],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: [],
    scopeAcknowledgement:
      "An exercise physiologist may design and supervise exercise programmes. You may not diagnose disease or provide medical nutrition therapy.",
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

  // Massachusetts constrains athletic trainers more tightly than any other
  // profession on this list, in a way that cuts against an open marketplace.
  //
  // M.G.L. c. 112, § 23A defines an athletic trainer as one "who limits his
  // practice to schools, teams or organizations with whom he is associated and
  // who is under the direction of a physician or dentist duly registered in the
  // commonwealth", and 259 CMR 4.02(2) repeats it: service is rendered "under
  // the Direction of a Physician or Dentist with respect to the Athletes
  // involved with the schools, teams or organizations with whom the Athletic
  // Trainer is Associated".
  //
  // So a Massachusetts AT cannot simply take a member of the public who walked
  // in from a scan. Whether DexaFit lists them at all is a product and legal
  // decision, not one this file should make, so the rules route every AT
  // application to a human with the restriction stated rather than silently
  // approving or silently barring them.
  ATHLETIC_TRAINER: {
    professionType: "ATHLETIC_TRAINER",
    credentials: [
      stateLicense("Athletic Trainer license"),
      {
        credentialType: "NATIONAL_CERTIFICATION",
        label: "BOC certification",
        required: true,
        // 259 CMR 4.03(1)(a) for initial licensure and 4.03(2)(b) for renewal:
        // this is Massachusetts law, not a DexaFit preference.
        legalRequirement: true,
        marketplaceRequirement: true,
        requiresNumber: true,
        requiresExpiration: true,
        requiresDocument: true,
        exampleIssuers: ["Board of Certification (BOC)"],
        helpText:
          "Massachusetts requires BOC certification in effect for the entire renewal period (259 CMR 4.03(2)(b)).",
      },
      {
        // The same card a personal trainer uploads, but here the state requires
        // it, so it keys as the shared CPR credential and is asked for once.
        ...CPR_AED,
        label: "Emergency Cardiac Care (CPR/AED) certification",
        legalRequirement: true,
        helpText:
          "Massachusetts requires Emergency Cardiac Care certification in effect for the entire renewal period (259 CMR 4.03(2)(a)).",
      },
      {
        credentialType: "SUPERVISION_AGREEMENT",
        label: "Directing physician or dentist agreement",
        required: true,
        legalRequirement: true,
        marketplaceRequirement: true,
        requiresExpiration: false,
        requiresDocument: true,
        helpText:
          "259 CMR 4.02(3) requires an agreed relationship with a physician or dentist who directs your practice, and written proof of it on request. Upload that written agreement.",
        issuerLabel: "Directing physician or dentist",
      },
    ],
    insuranceRequired: true,
    // Deliberately not set to false. Barring athletic trainers from the
    // marketplace is a decision for DexaFit, not an inference from the statute.
    independentListingAllowed: true,
    manualReviewRequired: true,
    extraQuestions: [],
    restrictionNotice:
      "Massachusetts licenses athletic trainers to work with athletes of the schools, teams or organizations they are associated with, under the direction of a physician or dentist (M.G.L. c. 112, § 23A; 259 CMR 4.02). A DexaFit reviewer will confirm how your practice fits this before your listing goes live.",
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
      {
        // 263 CMR 5.00: every professional activity of a PA is supervised by a
        // physician, under written guidelines signed by both and reviewed
        // annually. Unlike the athletic trainer restriction this does not
        // confine them to a setting, so it is a document to collect rather than
        // a reason to send the whole application to a human.
        credentialType: "SUPERVISION_AGREEMENT",
        label: "Supervising physician guidelines",
        required: true,
        legalRequirement: true,
        marketplaceRequirement: true,
        requiresExpiration: true,
        requiresDocument: true,
        helpText:
          "263 CMR 5.00 requires written guidelines signed by you and your supervising physician, reviewed annually. Upload the current signed guidelines and give the review date as the expiration.",
        issuerLabel: "Supervising physician",
      },
      NPI_OPTIONAL,
    ],
    insuranceRequired: true,
    independentListingAllowed: true,
    manualReviewRequired: false,
    extraQuestions: [],
    scopeAcknowledgement:
      "I confirm that all of my professional activity is supervised by a physician licensed in this state, under current written guidelines as required by 263 CMR 5.00.",
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
 * Credentials a person holds once, however many professions they list. A CPR
 * card and an NPI number do not multiply; a licence or a discipline-specific
 * certification does.
 */
const SHARED_CREDENTIALS: ReadonlySet<CredentialType> = new Set<CredentialType>([
  "CPR_AED",
  "NPI",
]);

export function requirementKey(
  professionType: ProfessionType,
  credentialType: CredentialType,
): string {
  return SHARED_CREDENTIALS.has(credentialType)
    ? credentialType
    : `${professionType}:${credentialType}`;
}

/**
 * Merge two requirements that resolved to the same key, keeping whichever is
 * stricter. Two professions asking for the same CPR card must not let the more
 * lenient of them soften the obligation.
 */
function stricter(
  a: CredentialRequirement,
  b: CredentialRequirement,
): CredentialRequirement {
  return {
    ...a,
    required: a.required || b.required,
    // These two describe *why* a credential is being asked for, and they merge
    // for the same reason everything else here does. A CPR card is DexaFit
    // policy for a personal trainer but Massachusetts law for an athletic
    // trainer (259 CMR 4.03(2)(a)); someone who is both must not be told it is
    // merely our policy because the trainer rule happened to be read first.
    legalRequirement: a.legalRequirement || b.legalRequirement,
    marketplaceRequirement: a.marketplaceRequirement || b.marketplaceRequirement,
    manualReviewIfMissing: Boolean(a.manualReviewIfMissing && b.manualReviewIfMissing),
    requiresDocument: a.requiresDocument || b.requiresDocument,
    requiresNumber: a.requiresNumber || b.requiresNumber,
    requiresExpiration: a.requiresExpiration || b.requiresExpiration,
    requiresJurisdiction: a.requiresJurisdiction || b.requiresJurisdiction,
    // Keep whichever help text explains the stricter obligation.
    helpText: a.legalRequirement ? a.helpText : (b.helpText ?? a.helpText),
  };
}

function labelForJurisdiction(
  requirement: CredentialRequirement,
  stateName: string,
): CredentialRequirement {
  const licenceLike =
    requirement.credentialType === "STATE_LICENSE" ||
    requirement.credentialType === "RN_LICENSE" ||
    requirement.credentialType === "APRN_AUTHORIZATION";
  return licenceLike
    ? { ...requirement, label: `${stateName} ${requirement.label}` }
    : requirement;
}

/**
 * Resolve the credentialing rules for everything a professional does, in a
 * jurisdiction.
 *
 * Only Massachusetts is researched for v1. Other states fall back to generic
 * labeling and manual review rather than asserting rules we have not verified —
 * which is what makes adding NY a config change rather than a rewrite.
 */
export function getRequirements(
  professionTypes: readonly ProfessionType[],
  jurisdictionState: string,
): ProfessionRequirements {
  const researched = (RESEARCHED_JURISDICTIONS as readonly string[]).includes(
    jurisdictionState,
  );
  const stateName = JURISDICTION_NAMES[jurisdictionState] ?? jurisdictionState;

  // Nothing chosen yet. Assert no rules rather than guessing at them; the
  // wizard will not let an application reach submission in this state.
  if (professionTypes.length === 0) {
    return {
      professionTypes: [],
      credentials: [],
      insuranceRequired: false,
      independentListingAllowed: true,
      manualReviewRequired: true,
      extraQuestions: [],
      jurisdictionResearched: researched,
    };
  }

  const byKey = new Map<string, CredentialRequirement>();
  const extraQuestions = new Set<ExtraQuestion>();
  const notices: string[] = [];
  const acknowledgements: string[] = [];

  let insuranceRequired = false;
  let independentListingAllowed = true;
  let manualReviewRequired = !researched;
  let jurisdictionResearched = researched;

  for (const professionType of professionTypes) {
    const rules = BASE_RULES[professionType];

    for (const spec of rules.credentials) {
      const keyed: CredentialRequirement = {
        ...spec,
        key: requirementKey(professionType, spec.credentialType),
      };
      const labelled = researched ? labelForJurisdiction(keyed, stateName) : keyed;
      const existing = byKey.get(labelled.key);
      byKey.set(labelled.key, existing ? stricter(existing, labelled) : labelled);
    }

    for (const question of rules.extraQuestions) extraQuestions.add(question);

    insuranceRequired ||= rules.insuranceRequired;
    manualReviewRequired ||= rules.manualReviewRequired;
    independentListingAllowed &&= rules.independentListingAllowed;
    jurisdictionResearched &&= rules.jurisdictionResearched;

    if (rules.restrictionNotice) notices.push(rules.restrictionNotice);
    if (rules.scopeAcknowledgement) acknowledgements.push(rules.scopeAcknowledgement);
  }

  if (!researched) {
    notices.push(
      "DexaFit has not yet completed credentialing rules for this state. Your application will be reviewed manually.",
    );
  }

  return {
    professionTypes: [...professionTypes],
    credentials: [...byKey.values()],
    insuranceRequired,
    independentListingAllowed,
    manualReviewRequired,
    extraQuestions: [...extraQuestions],
    restrictionNotice: notices.length > 0 ? notices.join(" ") : undefined,
    scopeAcknowledgement:
      acknowledgements.length > 0 ? acknowledgements.join(" ") : undefined,
    jurisdictionResearched,
  };
}

export function getRequiredCredentials(
  professionTypes: readonly ProfessionType[],
  jurisdictionState: string,
): CredentialRequirement[] {
  return getRequirements(professionTypes, jurisdictionState).credentials.filter(
    (c) => c.required,
  );
}

export function aprnCategoryRequired(
  professionTypes: readonly ProfessionType[],
): boolean {
  return professionTypes.includes("NURSE_PRACTITIONER");
}

export const APRN_CATEGORY_LABELS: Record<AprnCategory, string> = {
  CNP: "Certified Nurse Practitioner (CNP)",
  CNM: "Certified Nurse Midwife (CNM)",
  CRNA: "Certified Registered Nurse Anesthetist (CRNA)",
  PCNS: "Psychiatric Clinical Nurse Specialist (PCNS)",
  CNS: "Clinical Nurse Specialist (CNS)",
};
