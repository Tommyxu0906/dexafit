-- DexaFit Professional Onboarding & Credentialing v1
--
-- Jurisdiction is always modeled as (country, state). There are deliberately no
-- Massachusetts-specific columns: MA is a launch market, not a schema constraint.
--
-- Enumerated values are text + CHECK constraints rather than Postgres enum types,
-- so new profession types and credential types can ship in a plain migration
-- without ALTER TYPE locking.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

create table app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'PROFESSIONAL'
    check (role in ('PROFESSIONAL', 'ADMIN')),
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_users
    where id = auth.uid() and role = 'ADMIN'
  );
$$;

-- Mirror new auth users into app_users so a profile row always exists.
create function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into app_users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  dba text,
  business_email text,
  business_phone text,
  business_website text,
  address_1 text,
  address_2 text,
  city text,
  state text,
  postal_code text,
  country text not null default 'US',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Professional profile
-- ---------------------------------------------------------------------------

create table professional_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references app_users (id) on delete cascade,

  legal_first_name text,
  legal_last_name text,
  display_name text,

  profession_type text
    check (profession_type in (
      'PERSONAL_TRAINER',
      'STRENGTH_CONDITIONING_COACH',
      'SPORTS_PERFORMANCE_COACH',
      'HEALTH_WELLNESS_COACH',
      'NUTRITION_COACH',
      'DIETITIAN_NUTRITIONIST',
      'PHYSICAL_THERAPIST',
      'ATHLETIC_TRAINER',
      'LMHC',
      'LSMHC',
      'LMFT',
      'LICSW',
      'LCSW',
      'PSYCHOLOGIST',
      'PHYSICIAN',
      'NURSE_PRACTITIONER',
      'PHYSICIAN_ASSISTANT',
      'OTHER'
    )),
  professional_title text,
  bio text,
  years_experience integer check (years_experience >= 0),
  languages text[] not null default '{}',

  email text,
  phone text,
  profile_photo_document_id uuid,

  website_url text,
  linkedin_url text,
  instagram_url text,

  -- Practice
  joining_as text
    check (joining_as in ('INDIVIDUAL', 'ORGANIZATION_MEMBER', 'ORGANIZATION_OWNER')),
  practice_name text,
  organization_id uuid references organizations (id) on delete set null,
  business_email text,
  business_phone text,
  business_website text,
  service_modes text[] not null default '{}',
  accepting_new_clients boolean,

  -- Profession-specific answers that gate eligibility rather than belonging to a
  -- single credential row.
  holds_rd_rdn boolean,
  hsp_certified boolean,
  aprn_category text
    check (aprn_category in ('CNP', 'CNM', 'CRNA', 'PCNS', 'CNS')),
  supervisor_name text,
  supervisor_license_type text,
  supervisor_license_number text,
  supervising_organization text,

  marketplace_status text not null default 'INACTIVE'
    check (marketplace_status in ('INACTIVE', 'ACTIVE', 'SUSPENDED')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index professional_profiles_profession_type_idx
  on professional_profiles (profession_type);

create table professional_organization_memberships (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professional_profiles (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('MEMBER', 'OWNER')),
  created_at timestamptz not null default now(),
  unique (professional_id, organization_id)
);

-- ---------------------------------------------------------------------------
-- Application
-- ---------------------------------------------------------------------------

create table professional_applications (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null unique references professional_profiles (id) on delete cascade,

  status text not null default 'DRAFT'
    check (status in (
      'DRAFT',
      'SUBMITTED',
      'CREDENTIAL_REVIEW',
      'COMPLIANCE_REVIEW',
      'NEEDS_INFORMATION',
      'APPROVED',
      'REJECTED',
      'SUSPENDED',
      'EXPIRED'
    )),

  -- Wizard progress, so a refresh resumes where the provider left off.
  completed_steps text[] not null default '{}',

  manual_review_required boolean not null default false,
  independent_listing_eligible boolean,

  electronic_signature text,
  signature_date date,

  submitted_at timestamptz,
  reviewed_by uuid references app_users (id),
  reviewed_at timestamptz,
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index professional_applications_status_idx
  on professional_applications (status);

-- ---------------------------------------------------------------------------
-- Documents (private storage only)
-- ---------------------------------------------------------------------------

create table professional_documents (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professional_profiles (id) on delete cascade,

  document_type text not null
    check (document_type in (
      'PROFILE_PHOTO',
      'CREDENTIAL',
      'INSURANCE_CERTIFICATE',
      'COMPLIANCE_SUPPORTING'
    )),
  storage_key text not null unique,
  original_filename text not null,
  mime_type text not null,
  file_size integer not null,
  visibility text not null default 'PRIVATE' check (visibility in ('PRIVATE')),

  created_at timestamptz not null default now()
);

alter table professional_profiles
  add constraint professional_profiles_profile_photo_fk
  foreign key (profile_photo_document_id)
  references professional_documents (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Credentials
-- ---------------------------------------------------------------------------

create table credentials (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professional_profiles (id) on delete cascade,

  credential_type text not null
    check (credential_type in (
      'STATE_LICENSE',
      'NATIONAL_CERTIFICATION',
      'BOARD_CERTIFICATION',
      'CPR_AED',
      'RN_LICENSE',
      'APRN_AUTHORIZATION',
      'HSP_CERTIFICATION',
      'NPI',
      'OTHER'
    )),
  credential_name text not null,
  credential_number text,
  issuing_authority text,

  jurisdiction_country text not null default 'US',
  jurisdiction_state text,

  issue_date date,
  expiration_date date,

  verification_status text not null default 'UNVERIFIED'
    check (verification_status in (
      'UNVERIFIED',
      'PENDING',
      'VERIFIED',
      'REJECTED',
      'EXPIRED',
      'UNABLE_TO_VERIFY'
    )),
  verification_source_url text,
  verified_at timestamptz,
  verified_by uuid references app_users (id),
  admin_notes text,

  document_id uuid references professional_documents (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index credentials_professional_id_idx on credentials (professional_id);

-- ---------------------------------------------------------------------------
-- Insurance
-- ---------------------------------------------------------------------------

create table insurance_policies (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professional_profiles (id) on delete cascade,

  insurance_type text not null
    check (insurance_type in (
      'PROFESSIONAL_LIABILITY',
      'MALPRACTICE',
      'GENERAL_LIABILITY'
    )),
  carrier_name text not null,
  policy_number text not null,
  -- Amounts are collected but no minimum is enforced in v1; marketplace policy
  -- is still pending.
  coverage_per_claim numeric(14, 2),
  coverage_aggregate numeric(14, 2),
  effective_date date,
  expiration_date date,
  certificate_document_id uuid references professional_documents (id) on delete set null,

  status text not null default 'SUBMITTED'
    check (status in ('SUBMITTED', 'VERIFIED', 'REJECTED', 'EXPIRED')),
  verified_at timestamptz,
  verified_by uuid references app_users (id),
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index insurance_policies_professional_id_idx
  on insurance_policies (professional_id);

-- ---------------------------------------------------------------------------
-- Compliance disclosures
-- ---------------------------------------------------------------------------

create table compliance_disclosures (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professional_profiles (id) on delete cascade,

  disclosure_type text not null
    check (disclosure_type in (
      'LICENSE_EVER_SUSPENDED_REVOKED_RESTRICTED',
      'CURRENT_PRACTICE_RESTRICTIONS',
      'PENDING_DISCIPLINARY_PROCEEDINGS',
      'EXCLUDED_FROM_FEDERAL_HEALTHCARE_PROGRAM'
    )),
  answer boolean not null,
  explanation text,
  supporting_document_id uuid references professional_documents (id) on delete set null,

  resolved_by_admin boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references app_users (id),
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (professional_id, disclosure_type)
);

-- ---------------------------------------------------------------------------
-- Capabilities
-- ---------------------------------------------------------------------------

create table capabilities (
  code text primary key,
  label text not null,
  category text not null
    check (category in ('CLIENT_POPULATION', 'DEXA_CAPABILITY')),
  description text,
  sort_order integer not null default 0
);

create table professional_capabilities (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professional_profiles (id) on delete cascade,
  capability_code text not null references capabilities (code) on delete cascade,
  created_at timestamptz not null default now(),
  unique (professional_id, capability_code)
);

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------

create table service_offerings (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professional_profiles (id) on delete cascade,

  service_name text not null,
  service_description text not null,
  service_category text not null,
  modality text not null check (modality in ('IN_PERSON', 'VIRTUAL', 'HYBRID')),
  duration_minutes integer not null check (duration_minutes > 0),
  price_amount numeric(10, 2),
  price_currency text not null default 'USD',
  free_intro_consult boolean not null default false,
  -- Booking stays external until the commercial model is decided.
  booking_url text,
  accepts_self_pay boolean not null default true,
  accepts_insurance boolean not null default false,
  insurance_notes text,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index service_offerings_professional_id_idx
  on service_offerings (professional_id);

-- ---------------------------------------------------------------------------
-- Geography
-- ---------------------------------------------------------------------------

create table service_locations (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professional_profiles (id) on delete cascade,

  country text not null default 'US',
  state text not null,
  city text,
  postal_code text,
  address_1 text,
  address_2 text,
  service_mode text not null check (service_mode in ('IN_PERSON', 'VIRTUAL', 'HYBRID')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table professional_service_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professional_profiles (id) on delete cascade,

  country text not null default 'US',
  state text not null,
  profession_type text not null,
  -- For licensed professions this must point at an active license in that state.
  credential_id uuid references credentials (id) on delete set null,
  virtual_allowed boolean not null default false,
  in_person_allowed boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (professional_id, country, state)
);

-- ---------------------------------------------------------------------------
-- Attestations
-- ---------------------------------------------------------------------------

create table attestations (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professional_profiles (id) on delete cascade,

  attestation_type text not null,
  agreement_version text not null,
  accepted boolean not null default false,
  accepted_at timestamptz,
  ip_address text,

  created_at timestamptz not null default now(),

  unique (professional_id, attestation_type, agreement_version)
);

-- ---------------------------------------------------------------------------
-- Review audit trail
-- ---------------------------------------------------------------------------

create table application_review_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references professional_applications (id) on delete cascade,

  event_type text not null
    check (event_type in (
      'SUBMITTED',
      'STATUS_CHANGED',
      'CREDENTIAL_VERIFIED',
      'CREDENTIAL_REJECTED',
      'CREDENTIAL_UNABLE_TO_VERIFY',
      'INSURANCE_REVIEWED',
      'INFORMATION_REQUESTED',
      'APPROVED',
      'REJECTED',
      'SUSPENDED',
      'NOTE_ADDED',
      'REOPENED_FOR_REVIEW'
    )),
  from_status text,
  to_status text,
  subject_table text,
  subject_id uuid,
  note text,

  actor_id uuid references app_users (id),
  created_at timestamptz not null default now()
);

create index application_review_events_application_id_idx
  on application_review_events (application_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'app_users',
    'organizations',
    'professional_profiles',
    'professional_applications',
    'credentials',
    'insurance_policies',
    'compliance_disclosures',
    'service_offerings',
    'service_locations',
    'professional_service_jurisdictions'
  ]
  loop
    execute format(
      'create trigger %I_touch_updated_at before update on %I
       for each row execute function touch_updated_at()', t, t
    );
  end loop;
end;
$$;
