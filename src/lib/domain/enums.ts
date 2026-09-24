export const PROFESSION_TYPES = [
  "PERSONAL_TRAINER",
  "STRENGTH_CONDITIONING_COACH",
  "EXERCISE_PHYSIOLOGIST",
  "HEALTH_WELLNESS_COACH",
  "NUTRITION_COACH",
  "DIETITIAN_NUTRITIONIST",
  "PHYSICAL_THERAPIST",
  "ATHLETIC_TRAINER",
  "PHYSICIAN",
  "NURSE_PRACTITIONER",
  "PHYSICIAN_ASSISTANT",
  "OTHER",
] as const;

export type ProfessionType = (typeof PROFESSION_TYPES)[number];

export const PROFESSION_LABELS: Record<ProfessionType, string> = {
  PERSONAL_TRAINER: "Personal trainer",
  STRENGTH_CONDITIONING_COACH: "Strength & conditioning coach",
  EXERCISE_PHYSIOLOGIST: "Exercise physiologist",
  HEALTH_WELLNESS_COACH: "Health & wellness coach",
  // The two nutrition roles stay separate on purpose. A nutrition coach holds a
  // certification; a dietitian holds a state licence and may provide medical
  // nutrition therapy. Merging them would let an uncredentialed coach claim
  // capabilities only a licensed dietitian may legally hold.
  NUTRITION_COACH: "Nutrition coach (certification)",
  DIETITIAN_NUTRITIONIST: "Registered Dietitian / Nutritionist (licensed)",
  PHYSICAL_THERAPIST: "Physical therapist",
  ATHLETIC_TRAINER: "Athletic trainer",
  PHYSICIAN: "Physician (MD / DO)",
  NURSE_PRACTITIONER: "Nurse practitioner",
  PHYSICIAN_ASSISTANT: "Physician assistant",
  OTHER: "Other",
};

export const CREDENTIAL_TYPES = [
  "STATE_LICENSE",
  "NATIONAL_CERTIFICATION",
  "BOARD_CERTIFICATION",
  "CPR_AED",
  "RN_LICENSE",
  "APRN_AUTHORIZATION",
  "HSP_CERTIFICATION",
  "SUPERVISION_AGREEMENT",
  "NPI",
  "OTHER",
] as const;

export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  STATE_LICENSE: "State license",
  NATIONAL_CERTIFICATION: "National certification",
  BOARD_CERTIFICATION: "Board certification",
  CPR_AED: "CPR/AED certification",
  RN_LICENSE: "RN license",
  APRN_AUTHORIZATION: "APRN authorization",
  HSP_CERTIFICATION: "Health Service Provider (HSP) certification",
  SUPERVISION_AGREEMENT: "Supervising clinician agreement",
  NPI: "NPI",
  OTHER: "Other",
};

export const VERIFICATION_STATUSES = [
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "EXPIRED",
  "UNABLE_TO_VERIFY",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const APPLICATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "CREDENTIAL_REVIEW",
  "COMPLIANCE_REVIEW",
  "NEEDS_INFORMATION",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
  "EXPIRED",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const MARKETPLACE_STATUSES = ["INACTIVE", "ACTIVE", "SUSPENDED"] as const;
export type MarketplaceStatus = (typeof MARKETPLACE_STATUSES)[number];

export const SERVICE_MODES = ["IN_PERSON", "VIRTUAL", "HYBRID"] as const;
export type ServiceMode = (typeof SERVICE_MODES)[number];

export const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  IN_PERSON: "In person",
  VIRTUAL: "Virtual",
  HYBRID: "Hybrid",
};

/**
 * What kind of thing a provider is selling. Chosen first on the products form,
 * because it decides which of the remaining fields apply — an item bought
 * online has no appointment length.
 */
export const PRODUCT_TYPES = [
  "IN_PERSON_SERVICE",
  "ECOMMERCE",
  "PROFESSIONAL_SERVICE",
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  IN_PERSON_SERVICE: "In-person service",
  ECOMMERCE: "Product for sale",
  PROFESSIONAL_SERVICE: "Professional service",
};

export const PRODUCT_TYPE_DESCRIPTIONS: Record<ProductType, string> = {
  IN_PERSON_SERVICE: "A session you deliver face to face, booked for a length of time.",
  ECOMMERCE: "Something a client buys outright — a plan, a programme, a physical item.",
  PROFESSIONAL_SERVICE: "Anything else you offer, remote or otherwise.",
};

/** Only a booked session has a length. */
export function productNeedsDuration(productType: string): boolean {
  return productType === "IN_PERSON_SERVICE" || productType === "PROFESSIONAL_SERVICE";
}

export const JOINING_AS = [
  "INDIVIDUAL",
  "ORGANIZATION_MEMBER",
  "ORGANIZATION_OWNER",
] as const;
export type JoiningAs = (typeof JOINING_AS)[number];

export const JOINING_AS_LABELS: Record<JoiningAs, string> = {
  INDIVIDUAL: "Individual professional",
  ORGANIZATION_MEMBER: "Member of a practice or clinic",
  ORGANIZATION_OWNER: "Practice or clinic owner",
};

/** Asked in step 1, because it decides what the rest of the wizard collects. */
export const JOINING_AS_DESCRIPTIONS: Record<JoiningAs, string> = {
  INDIVIDUAL: "You practise under your own name and hold your own insurance.",
  ORGANIZATION_MEMBER:
    "You work at a practice someone else owns. We will ask for its details.",
  ORGANIZATION_OWNER:
    "You own the practice. We will ask for its legal details and address.",
};

export const INSURANCE_TYPES = [
  "PROFESSIONAL_LIABILITY",
  "MALPRACTICE",
  "GENERAL_LIABILITY",
] as const;
export type InsuranceType = (typeof INSURANCE_TYPES)[number];

export const INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
  PROFESSIONAL_LIABILITY: "Professional liability",
  MALPRACTICE: "Malpractice",
  GENERAL_LIABILITY: "General liability",
};

export const DISCLOSURE_TYPES = [
  "LICENSE_EVER_SUSPENDED_REVOKED_RESTRICTED",
  "CURRENT_PRACTICE_RESTRICTIONS",
  "PENDING_DISCIPLINARY_PROCEEDINGS",
  "EXCLUDED_FROM_FEDERAL_HEALTHCARE_PROGRAM",
] as const;
export type DisclosureType = (typeof DISCLOSURE_TYPES)[number];

export const DISCLOSURE_QUESTIONS: Record<DisclosureType, string> = {
  LICENSE_EVER_SUSPENDED_REVOKED_RESTRICTED:
    "Has a professional license or certification of yours ever been suspended, revoked, restricted or surrendered?",
  CURRENT_PRACTICE_RESTRICTIONS:
    "Do you currently have any restrictions on your ability to practice?",
  PENDING_DISCIPLINARY_PROCEEDINGS:
    "Are any disciplinary proceedings currently pending against you?",
  EXCLUDED_FROM_FEDERAL_HEALTHCARE_PROGRAM:
    "Have you been excluded from participation in Medicare, Medicaid or another federal healthcare program?",
};

export const APRN_CATEGORIES = ["CNP", "CNM", "CRNA", "PCNS", "CNS"] as const;
export type AprnCategory = (typeof APRN_CATEGORIES)[number];

export const DOCUMENT_TYPES = [
  "PROFILE_PHOTO",
  "CREDENTIAL",
  "INSURANCE_CERTIFICATE",
  "COMPLIANCE_SUPPORTING",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const LANGUAGES = [
  "English",
  "Spanish",
  "Portuguese",
  "Mandarin",
  "Cantonese",
  "French",
  "Haitian Creole",
  "Vietnamese",
  "Russian",
  "Arabic",
  "Hindi",
  "Korean",
  "Japanese",
  "American Sign Language",
] as const;

export const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
  ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
] as const;

// Launch market. The database is jurisdiction-neutral; this only seeds UI defaults.
export const DEFAULT_COUNTRY = "US";
export const DEFAULT_STATE = "MA";
