import type {
  AprnCategory,
  ApplicationStatus,
  CredentialType,
  DisclosureType,
  DocumentType,
  InsuranceType,
  JoiningAs,
  MarketplaceStatus,
  ProfessionType,
  ServiceMode,
  VerificationStatus,
} from "../domain/enums";

export type ProfessionalProfileRow = {
  id: string;
  user_id: string;
  legal_first_name: string | null;
  legal_last_name: string | null;
  display_name: string | null;
  /** Everything this professional practises. Empty until step 1 is saved. */
  profession_types: ProfessionType[];
  professional_title: string | null;
  bio: string | null;
  years_experience: number | null;
  languages: string[];
  email: string | null;
  phone: string | null;
  profile_photo_document_id: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  joining_as: JoiningAs | null;
  practice_name: string | null;
  organization_id: string | null;
  business_email: string | null;
  business_phone: string | null;
  business_website: string | null;
  service_modes: ServiceMode[];
  accepting_new_clients: boolean | null;
  holds_rd_rdn: boolean | null;
  hsp_certified: boolean | null;
  aprn_category: AprnCategory | null;
  supervisor_name: string | null;
  supervisor_license_type: string | null;
  supervisor_license_number: string | null;
  supervising_organization: string | null;
  marketplace_status: MarketplaceStatus;
  created_at: string;
  updated_at: string;
};

export type ApplicationRow = {
  id: string;
  professional_id: string;
  status: ApplicationStatus;
  completed_steps: string[];
  manual_review_required: boolean;
  independent_listing_eligible: boolean | null;
  electronic_signature: string | null;
  signature_date: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CredentialRow = {
  id: string;
  professional_id: string;
  /**
   * Which requirement this credential satisfies; see `requirementKey`.
   * NOT NULL in the database since migration 0012 — readiness matches on this
   * and never on credential_type, so a missing value has no safe meaning.
   */
  requirement_key: string;
  credential_type: CredentialType;
  credential_name: string;
  credential_number: string | null;
  issuing_authority: string | null;
  jurisdiction_country: string;
  jurisdiction_state: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  verification_status: VerificationStatus;
  verification_source_url: string | null;
  verified_at: string | null;
  verified_by: string | null;
  admin_notes: string | null;
  document_id: string | null;
  created_at: string;
  updated_at: string;
};

export type InsurancePolicyRow = {
  id: string;
  professional_id: string;
  insurance_type: InsuranceType;
  carrier_name: string;
  policy_number: string;
  coverage_per_claim: number | null;
  coverage_aggregate: number | null;
  effective_date: string | null;
  expiration_date: string | null;
  certificate_document_id: string | null;
  status: "SUBMITTED" | "VERIFIED" | "REJECTED" | "EXPIRED";
  verified_at: string | null;
  verified_by: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ComplianceDisclosureRow = {
  id: string;
  professional_id: string;
  disclosure_type: DisclosureType;
  answer: boolean;
  explanation: string | null;
  supporting_document_id: string | null;
  resolved_by_admin: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  admin_notes: string | null;
};

export type DocumentRow = {
  id: string;
  professional_id: string;
  document_type: DocumentType;
  storage_key: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

export type ServiceOfferingRow = {
  id: string;
  professional_id: string;
  service_name: string;
  service_description: string;
  service_category: string;
  modality: ServiceMode;
  duration_minutes: number;
  price_amount: number | null;
  price_currency: string;
  free_intro_consult: boolean;
  booking_url: string | null;
  accepts_self_pay: boolean;
  accepts_insurance: boolean;
  insurance_notes: string | null;
  active: boolean;
};

export type ServiceLocationRow = {
  id: string;
  professional_id: string;
  country: string;
  state: string;
  city: string | null;
  postal_code: string | null;
  address_1: string | null;
  address_2: string | null;
  service_mode: ServiceMode;
};

export type JurisdictionRow = {
  id: string;
  professional_id: string;
  country: string;
  state: string;
  profession_type: string;
  credential_id: string | null;
  virtual_allowed: boolean;
  in_person_allowed: boolean;
};

export type CapabilityRow = {
  code: string;
  label: string;
  category: "CLIENT_POPULATION" | "DEXA_CAPABILITY";
  sort_order: number;
};

export type ProfessionalCapabilityRow = {
  id: string;
  professional_id: string;
  capability_code: string;
};

export type AttestationRow = {
  id: string;
  professional_id: string;
  attestation_type: string;
  agreement_version: string;
  accepted: boolean;
  accepted_at: string | null;
  ip_address: string | null;
};

export type ReviewEventRow = {
  id: string;
  application_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  subject_table: string | null;
  subject_id: string | null;
  note: string | null;
  actor_id: string | null;
  created_at: string;
};

export type ApplicationBundle = {
  profile: ProfessionalProfileRow;
  application: ApplicationRow;
  credentials: CredentialRow[];
  insurancePolicies: InsurancePolicyRow[];
  disclosures: ComplianceDisclosureRow[];
  documents: DocumentRow[];
  services: ServiceOfferingRow[];
  locations: ServiceLocationRow[];
  jurisdictions: JurisdictionRow[];
  capabilities: ProfessionalCapabilityRow[];
  attestations: AttestationRow[];
};
