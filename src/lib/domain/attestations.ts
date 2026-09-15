/**
 * Attestation copy is PLACEHOLDER TEXT PENDING LEGAL REVIEW. It is versioned so
 * that when counsel supplies final language we bump AGREEMENT_VERSION and every
 * prior acceptance stays attributable to the text that was actually shown.
 *
 * Do not treat this wording as attorney-approved.
 */
export const AGREEMENT_VERSION = "2026-09-draft-1";

export const ATTESTATION_TYPES = [
  "INFORMATION_ACCURATE",
  "MAINTAIN_CREDENTIALS",
  "NOTIFY_STATUS_CHANGE",
  "PRACTICE_WITHIN_SCOPE",
  "NO_DIAGNOSIS_REPRESENTATION",
  "AUTHORIZED_USE_OF_HEALTH_INFORMATION",
  "NO_UNAUTHORIZED_SCAN_ACCESS",
  "MARKETPLACE_TERMS",
] as const;

export type AttestationType = (typeof ATTESTATION_TYPES)[number];

export const ATTESTATION_TEXT: Record<AttestationType, string> = {
  INFORMATION_ACCURATE:
    "I certify that the information provided in this application is accurate and complete.",
  MAINTAIN_CREDENTIALS:
    "I agree to maintain all licenses, certifications and insurance required for the services I provide.",
  NOTIFY_STATUS_CHANGE:
    "I agree to notify DexaFit if my professional status changes, including any lapse, restriction or disciplinary action.",
  PRACTICE_WITHIN_SCOPE:
    "I agree to provide services only within my lawful professional scope.",
  NO_DIAGNOSIS_REPRESENTATION:
    "I will not represent DexaFit scan findings as a medical diagnosis unless I am legally qualified to make such a diagnosis.",
  AUTHORIZED_USE_OF_HEALTH_INFORMATION:
    "I understand that customer health information may only be used for the authorized referral or service purpose.",
  NO_UNAUTHORIZED_SCAN_ACCESS:
    "I will not access or use identifiable customer scan data without appropriate authorization.",
  MARKETPLACE_TERMS:
    "I agree to the DexaFit Professional Marketplace Terms. [PLACEHOLDER — pending legal review]",
};

export const LEGAL_REVIEW_NOTICE =
  "Draft terms pending legal review. Final agreement language will be provided by DexaFit before launch.";
