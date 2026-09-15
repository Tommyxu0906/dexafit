import type {
  ApplicationStatus,
  CredentialType,
  ProfessionType,
  VerificationStatus,
} from "./enums";
import { getRequirements, requiresHspForIndependentListing } from "./requirements";

export type ReadinessProfile = {
  professionType: ProfessionType | null;
  legalFirstName?: string | null;
  legalLastName?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  bio?: string | null;
  yearsExperience?: number | null;
  languages?: string[] | null;
  profilePhotoDocumentId?: string | null;
  hspCertified?: boolean | null;
  supervisorName?: string | null;
  supervisorLicenseNumber?: string | null;
};

export type ReadinessCredential = {
  id: string;
  credentialType: CredentialType;
  verificationStatus: VerificationStatus;
  expirationDate?: string | null;
  jurisdictionState?: string | null;
};

export type ReadinessInsurance = {
  id: string;
  expirationDate?: string | null;
  status: "SUBMITTED" | "VERIFIED" | "REJECTED" | "EXPIRED";
};

export type ReadinessDisclosure = {
  disclosureType: string;
  answer: boolean;
  resolvedByAdmin: boolean;
};

export type ReadinessInput = {
  profile: ReadinessProfile;
  applicationStatus: ApplicationStatus;
  credentials: ReadinessCredential[];
  insurancePolicies: ReadinessInsurance[];
  disclosures: ReadinessDisclosure[];
  /** Jurisdiction the professional is applying to serve. */
  jurisdictionState: string;
  /** Injected so readiness is a pure function and testable. */
  now?: Date;
};

export type BlockerCode =
  | "PROFILE_INCOMPLETE"
  | "PROFESSION_NOT_SELECTED"
  | "CREDENTIAL_MISSING"
  | "CREDENTIAL_NOT_VERIFIED"
  | "CREDENTIAL_EXPIRED"
  | "INSURANCE_MISSING"
  | "INSURANCE_EXPIRED"
  | "COMPLIANCE_FLAG_UNRESOLVED"
  | "INDEPENDENT_PRACTICE_NOT_PERMITTED"
  | "NOT_ADMIN_APPROVED";

export type Blocker = {
  code: BlockerCode;
  message: string;
  /** Present when the blocker is tied to a specific credential requirement. */
  credentialType?: CredentialType;
};

export type ReadinessResult = {
  /** True only when every rule passes — the gate for marketplace ACTIVE. */
  ready: boolean;
  blockers: Blocker[];
  independentListingEligible: boolean;
  manualReviewRequired: boolean;
  /** Reason independent listing was denied, for admin display. */
  independentListingNotice?: string;
};

function isExpired(date: string | null | undefined, now: Date): boolean {
  if (!date) return false;
  const parsed = new Date(`${date}T23:59:59Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < now.getTime();
}

function profileComplete(profile: ReadinessProfile): boolean {
  return Boolean(
    profile.legalFirstName &&
      profile.legalLastName &&
      profile.displayName &&
      profile.email &&
      profile.phone &&
      profile.bio &&
      profile.professionType &&
      profile.profilePhotoDocumentId &&
      typeof profile.yearsExperience === "number" &&
      profile.yearsExperience >= 0 &&
      profile.languages &&
      profile.languages.length > 0,
  );
}

/**
 * Whether the professional may be listed practicing independently.
 *
 * Three Massachusetts rules are product rules, not admin discretion:
 *   LSMHC                    — supervised license, never independent
 *   LCSW                     — no independent clinical private practice (LICSW can)
 *   Psychologist without HSP — cannot independently offer health services
 */
export function evaluateIndependentListing(
  profile: ReadinessProfile,
  jurisdictionState: string,
): { eligible: boolean; notice?: string } {
  const professionType = profile.professionType;
  if (!professionType) return { eligible: false, notice: "No profession selected." };

  const requirements = getRequirements(professionType, jurisdictionState);

  if (!requirements.independentListingAllowed) {
    return {
      eligible: false,
      notice:
        requirements.restrictionNotice ??
        "This license type is not eligible for an independent marketplace listing.",
    };
  }

  if (requiresHspForIndependentListing(professionType) && !profile.hspCertified) {
    return {
      eligible: false,
      notice:
        "A licensed psychologist without Health Service Provider (HSP) certification cannot independently offer health services.",
    };
  }

  return { eligible: true };
}

/**
 * Deterministic approval readiness. Marketplace status may only become ACTIVE
 * when this returns ready: true.
 */
export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const now = input.now ?? new Date();
  const blockers: Blocker[] = [];
  const { profile, credentials, insurancePolicies, disclosures } = input;

  if (!profile.professionType) {
    return {
      ready: false,
      blockers: [
        {
          code: "PROFESSION_NOT_SELECTED",
          message: "Profession type has not been selected.",
        },
      ],
      independentListingEligible: false,
      manualReviewRequired: true,
    };
  }

  const requirements = getRequirements(profile.professionType, input.jurisdictionState);

  if (!profileComplete(profile)) {
    blockers.push({
      code: "PROFILE_INCOMPLETE",
      message: "Required profile fields are incomplete.",
    });
  }

  let manualReviewRequired = requirements.manualReviewRequired;

  for (const requirement of requirements.credentials) {
    if (!requirement.required) continue;

    const matching = credentials.filter(
      (c) => c.credentialType === requirement.credentialType,
    );

    if (matching.length === 0) {
      if (requirement.manualReviewIfMissing) {
        manualReviewRequired = true;
      } else {
        blockers.push({
          code: "CREDENTIAL_MISSING",
          message: `Missing required credential: ${requirement.label}.`,
          credentialType: requirement.credentialType,
        });
      }
      continue;
    }

    const verified = matching.filter((c) => c.verificationStatus === "VERIFIED");
    if (verified.length === 0) {
      blockers.push({
        code: "CREDENTIAL_NOT_VERIFIED",
        message: `${requirement.label} has not been verified by DexaFit.`,
        credentialType: requirement.credentialType,
      });
      continue;
    }

    const unexpired = verified.filter(
      (c) => !isExpired(c.expirationDate, now) && c.verificationStatus !== "EXPIRED",
    );
    if (unexpired.length === 0) {
      blockers.push({
        code: "CREDENTIAL_EXPIRED",
        message: `${requirement.label} is expired.`,
        credentialType: requirement.credentialType,
      });
    }
  }

  if (requirements.insuranceRequired) {
    const current = insurancePolicies.filter(
      (p) => p.status !== "REJECTED" && !isExpired(p.expirationDate, now),
    );
    if (insurancePolicies.length === 0) {
      blockers.push({
        code: "INSURANCE_MISSING",
        message: "Professional liability insurance is required to list on DexaFit.",
      });
    } else if (current.length === 0) {
      blockers.push({
        code: "INSURANCE_EXPIRED",
        message: "Insurance coverage on file is expired.",
      });
    }
  }

  const unresolvedFlags = disclosures.filter((d) => d.answer && !d.resolvedByAdmin);
  if (unresolvedFlags.length > 0) {
    manualReviewRequired = true;
    blockers.push({
      code: "COMPLIANCE_FLAG_UNRESOLVED",
      message: `${unresolvedFlags.length} compliance disclosure(s) require review.`,
    });
  }

  const independent = evaluateIndependentListing(profile, input.jurisdictionState);
  if (!independent.eligible) {
    manualReviewRequired = true;
    blockers.push({
      code: "INDEPENDENT_PRACTICE_NOT_PERMITTED",
      message:
        independent.notice ??
        "This professional is not eligible for an independent listing.",
    });
  }

  if (input.applicationStatus !== "APPROVED") {
    blockers.push({
      code: "NOT_ADMIN_APPROVED",
      message: "Application has not been approved by a DexaFit reviewer.",
    });
  }

  return {
    ready: blockers.length === 0,
    blockers,
    independentListingEligible: independent.eligible,
    manualReviewRequired,
    independentListingNotice: independent.notice,
  };
}

/**
 * Readiness excluding admin approval — what the reviewer sees before deciding.
 */
export function computePreApprovalReadiness(
  input: ReadinessInput,
): ReadinessResult {
  const result = computeReadiness({ ...input, applicationStatus: "APPROVED" });
  return result;
}
