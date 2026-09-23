-- Demo providers for a walkthrough.
--
--   npm run seed:demo
--
-- Four fictional applicants, chosen to show the parts of the credentialing
-- engine that distinguish it from a form:
--
--   Marcus Whitfield    personal trainer          everything verified, ready to approve
--   Elena Vasquez       physical therapist        licence still to verify, so Approve stays locked
--   Priya Raghunathan   physical therapist + RD   TWO state licences, because one does not
--                                                 satisfy the other, and she may claim medical
--                                                 nutrition therapy only because of the RD licence
--   Jordan Ellis        S&C coach + exercise      two certifications, but only ONE CPR card:
--                       physiologist              a credential a person holds once is asked
--                                                 for once
--
-- Priya and Jordan are the pair worth showing. They are the two halves of the
-- multi-profession rule: qualifications that each demand their own credential,
-- and qualifications that share one.
--
-- Re-running replaces them. Nothing else in the database is touched: every
-- statement is keyed to the fixed ids below.
--
-- Every address is @demo.dexafit.invalid. `.invalid` is reserved by RFC 2606
-- and cannot resolve, so a stray notification can never reach a real person.
--
-- Known limitation: the document rows point at storage keys with no object
-- behind them, because bytes cannot be put in Storage over SQL. The review
-- page lists the documents; downloading one will fail. Upload a file through
-- the wizard if the walkthrough needs a working download.

\if :{?allow_demo_seed}
\else
\warn ''
\warn '  Refusing to seed.'
\warn ''
\warn '  This writes demo applicants into whatever database it is pointed at.'
\warn '  Run it deliberately:'
\warn ''
\warn '      npm run seed:demo'
\warn ''
\warn '  or, against a specific database:'
\warn ''
\warn '      psql "$URL" -v allow_demo_seed=yes -f supabase/seed/demo.sql'
\warn ''
\quit
\endif

begin;

-- ---------------------------------------------------------------------------
-- Clear any previous run
-- ---------------------------------------------------------------------------

-- app_users cascades from auth.users, and professional_profiles from app_users,
-- so everything below goes with these rows.
--
-- The audit trail is append-only and refuses the cascading delete, which is the
-- guarantee doing its job. The trigger is dropped for the length of this
-- transaction and restored by the commit, so the guarantee is never off outside
-- this script.
--
-- Worth knowing: the same trigger means a real provider's account cannot be
-- deleted either. A retention or erasure request will need a decided answer,
-- because the audit history is deliberately not erasable by ordinary means.
alter table application_review_events disable trigger reject_review_event_mutation;

delete from auth.users where email like '%@demo.dexafit.invalid';

alter table application_review_events enable trigger reject_review_event_mutation;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, email_confirmed_at) values
  ('d0000000-0000-4000-8000-00000000d001', 'marcus.whitfield@demo.dexafit.invalid', now()),
  ('d0000000-0000-4000-8000-00000000d002', 'elena.vasquez@demo.dexafit.invalid', now()),
  ('d0000000-0000-4000-8000-00000000d003', 'priya.raghunathan@demo.dexafit.invalid', now()),
  ('d0000000-0000-4000-8000-00000000d004', 'jordan.ellis@demo.dexafit.invalid', now());

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

insert into professional_profiles (
  id, user_id, legal_first_name, legal_last_name, display_name,
  profession_types, professional_title, bio, years_experience, languages,
  email, phone, joining_as, practice_name,
  business_email, business_phone, service_modes, accepting_new_clients,
  marketplace_status
) values
  ('d1000000-0000-4000-8000-00000000d001', 'd0000000-0000-4000-8000-00000000d001',
   'Marcus', 'Whitfield', 'Marcus Whitfield',
   array['PERSONAL_TRAINER'], 'NASM-CPT, CES',
   'I work with adults who want to change their body composition without giving up the rest of their life. Most of my clients come to me after a scan showing low lean mass or high visceral fat, and we build from there: progressive strength work, realistic nutrition habits, and a re-scan every twelve weeks so the plan answers to data instead of to how the week felt.',
   9, array['English'],
   'marcus.whitfield@demo.dexafit.invalid', '+16175550142',
   'INDIVIDUAL', 'Whitfield Strength',
   'hello@demo.dexafit.invalid', '+16175550142',
   array['IN_PERSON', 'VIRTUAL'], true, 'INACTIVE'),

  ('d1000000-0000-4000-8000-00000000d002', 'd0000000-0000-4000-8000-00000000d002',
   'Elena', 'Vasquez', 'Dr. Elena Vasquez, PT, DPT',
   array['PHYSICAL_THERAPIST'], 'PT, DPT, OCS',
   'Orthopaedic physical therapist focused on return to loading after injury. I see a lot of people who have been told to rest and have lost more muscle than they realise; a DEXA scan makes that concrete and gives us something to rebuild against. I treat one patient at a time, for a full hour, and I do not double-book.',
   14, array['English', 'Spanish'],
   'elena.vasquez@demo.dexafit.invalid', '+16175550168',
   'ORGANIZATION_MEMBER', 'Charles River Orthopedic PT',
   'front.desk@demo.dexafit.invalid', '+16175550100',
   array['IN_PERSON'], true, 'INACTIVE'),

  -- Two licensed professions. Two separate state licences, and the medical
  -- nutrition therapy capability is hers only because of the second one.
  ('d1000000-0000-4000-8000-00000000d003', 'd0000000-0000-4000-8000-00000000d003',
   'Priya', 'Raghunathan', 'Priya Raghunathan, PT, RD',
   array['PHYSICAL_THERAPIST', 'DIETITIAN_NUTRITIONIST'], 'PT, DPT, RD, LDN',
   'I trained first as a physical therapist and then as a dietitian, because I kept meeting people whose rehab stalled for reasons that had nothing to do with their training and everything to do with what they were eating. I work mostly with older adults rebuilding bone density and lean mass, where the loading and the protein intake have to be planned together or neither works.',
   16, array['English', 'Tamil'],
   'priya.raghunathan@demo.dexafit.invalid', '+16175550184',
   'INDIVIDUAL', 'Raghunathan Integrated Care',
   'priya.raghunathan@demo.dexafit.invalid', '+16175550184',
   array['IN_PERSON', 'VIRTUAL'], true, 'INACTIVE'),

  -- Two certifications, neither of them a licence — and one CPR card between
  -- them, which is the other half of the multi-profession rule.
  ('d1000000-0000-4000-8000-00000000d004', 'd0000000-0000-4000-8000-00000000d004',
   'Jordan', 'Ellis', 'Jordan Ellis, CSCS',
   array['STRENGTH_CONDITIONING_COACH', 'EXERCISE_PHYSIOLOGIST'], 'CSCS, ACSM-EP',
   'Strength coach and exercise physiologist. I spend half my week with competitive masters athletes and the other half with people whose doctor has just told them their bone density is heading the wrong way. Both groups need progressive loading and objective measurement; the difference is how fast you can add weight.',
   7, array['English'],
   'jordan.ellis@demo.dexafit.invalid', '+16175550199',
   'INDIVIDUAL', 'Ellis Performance Lab',
   'jordan.ellis@demo.dexafit.invalid', '+16175550199',
   array['IN_PERSON'], true, 'INACTIVE');

-- ---------------------------------------------------------------------------
-- Documents
--
-- Rows only; see the limitation noted at the top of this file.
-- ---------------------------------------------------------------------------

insert into professional_documents (
  id, professional_id, document_type, storage_key, original_filename,
  mime_type, file_size
)
select
  d.id, d.professional_id, d.document_type,
  d.professional_id || '/' || d.document_type || '/' || d.id || '.pdf',
  d.filename, 'application/pdf', 184320
from (values
  ('d9000000-0000-4000-8000-00000000d001'::uuid, 'd1000000-0000-4000-8000-00000000d001'::uuid, 'PROFILE_PHOTO', 'marcus-headshot.pdf'),
  ('d9000000-0000-4000-8000-00000000d002'::uuid, 'd1000000-0000-4000-8000-00000000d002'::uuid, 'PROFILE_PHOTO', 'vasquez-headshot.pdf'),
  ('d9000000-0000-4000-8000-00000000d003'::uuid, 'd1000000-0000-4000-8000-00000000d003'::uuid, 'PROFILE_PHOTO', 'raghunathan-headshot.pdf'),
  ('d9000000-0000-4000-8000-00000000d004'::uuid, 'd1000000-0000-4000-8000-00000000d004'::uuid, 'PROFILE_PHOTO', 'ellis-headshot.pdf'),
  ('d9000000-0000-4000-8000-00000000d011'::uuid, 'd1000000-0000-4000-8000-00000000d001'::uuid, 'CREDENTIAL', 'nasm-cpt-certificate.pdf'),
  ('d9000000-0000-4000-8000-00000000d012'::uuid, 'd1000000-0000-4000-8000-00000000d001'::uuid, 'CREDENTIAL', 'aha-cpr-aed-card.pdf'),
  ('d9000000-0000-4000-8000-00000000d013'::uuid, 'd1000000-0000-4000-8000-00000000d002'::uuid, 'CREDENTIAL', 'ma-pt-license.pdf'),
  ('d9000000-0000-4000-8000-00000000d014'::uuid, 'd1000000-0000-4000-8000-00000000d003'::uuid, 'CREDENTIAL', 'raghunathan-ma-pt-license.pdf'),
  ('d9000000-0000-4000-8000-00000000d015'::uuid, 'd1000000-0000-4000-8000-00000000d003'::uuid, 'CREDENTIAL', 'raghunathan-ma-dietitian-license.pdf'),
  ('d9000000-0000-4000-8000-00000000d016'::uuid, 'd1000000-0000-4000-8000-00000000d004'::uuid, 'CREDENTIAL', 'nsca-cscs-certificate.pdf'),
  ('d9000000-0000-4000-8000-00000000d017'::uuid, 'd1000000-0000-4000-8000-00000000d004'::uuid, 'CREDENTIAL', 'acsm-ep-certificate.pdf'),
  ('d9000000-0000-4000-8000-00000000d018'::uuid, 'd1000000-0000-4000-8000-00000000d004'::uuid, 'CREDENTIAL', 'ellis-cpr-aed-card.pdf'),
  ('d9000000-0000-4000-8000-00000000d021'::uuid, 'd1000000-0000-4000-8000-00000000d001'::uuid, 'INSURANCE_CERTIFICATE', 'coi-whitfield.pdf'),
  ('d9000000-0000-4000-8000-00000000d022'::uuid, 'd1000000-0000-4000-8000-00000000d002'::uuid, 'INSURANCE_CERTIFICATE', 'coi-charles-river.pdf'),
  ('d9000000-0000-4000-8000-00000000d023'::uuid, 'd1000000-0000-4000-8000-00000000d003'::uuid, 'INSURANCE_CERTIFICATE', 'coi-raghunathan.pdf'),
  ('d9000000-0000-4000-8000-00000000d024'::uuid, 'd1000000-0000-4000-8000-00000000d004'::uuid, 'INSURANCE_CERTIFICATE', 'coi-ellis.pdf')
) as d(id, professional_id, document_type, filename);

-- professional_profiles references professional_documents and documents
-- reference profiles, so the photo is attached once both rows exist.
update professional_profiles p
   set profile_photo_document_id = d.id
  from professional_documents d
 where d.professional_id = p.id
   and d.document_type = 'PROFILE_PHOTO'
   and p.email like '%@demo.dexafit.invalid';

-- ---------------------------------------------------------------------------
-- Credentials
--
-- requirement_key is what ties a credential to the requirement it satisfies.
-- Priya has two rows keyed PHYSICAL_THERAPIST:STATE_LICENSE and
-- DIETITIAN_NUTRITIONIST:STATE_LICENSE; Jordan has one CPR row keyed plainly
-- CPR_AED, shared by both of his certifications.
-- ---------------------------------------------------------------------------

insert into credentials (
  professional_id, requirement_key, credential_type, credential_name,
  credential_number, issuing_authority, jurisdiction_country, jurisdiction_state,
  issue_date, expiration_date, verification_status, document_id
) values
  ('d1000000-0000-4000-8000-00000000d001', 'PERSONAL_TRAINER:NATIONAL_CERTIFICATION',
   'NATIONAL_CERTIFICATION', 'NASM Certified Personal Trainer', 'NASM-1184023', 'NASM',
   'US', null, date '2024-03-11', current_date + interval '14 months',
   'VERIFIED', 'd9000000-0000-4000-8000-00000000d011'),

  ('d1000000-0000-4000-8000-00000000d001', 'CPR_AED',
   'CPR_AED', 'CPR/AED for the Professional Rescuer', 'AHA-77120934',
   'American Heart Association',
   'US', null, date '2025-06-02', current_date + interval '9 months',
   'VERIFIED', 'd9000000-0000-4000-8000-00000000d012'),

  ('d1000000-0000-4000-8000-00000000d002', 'PHYSICAL_THERAPIST:STATE_LICENSE',
   'STATE_LICENSE', 'Physical Therapist license', 'PT-MA-42187',
   'Massachusetts Board of Registration in Allied Health Professions',
   'US', 'MA', date '2019-08-20', current_date + interval '20 months',
   'PENDING', 'd9000000-0000-4000-8000-00000000d013'),

  ('d1000000-0000-4000-8000-00000000d003', 'PHYSICAL_THERAPIST:STATE_LICENSE',
   'STATE_LICENSE', 'Physical Therapist license', 'PT-MA-31904',
   'Massachusetts Board of Registration in Allied Health Professions',
   'US', 'MA', date '2012-06-04', current_date + interval '18 months',
   'VERIFIED', 'd9000000-0000-4000-8000-00000000d014'),

  ('d1000000-0000-4000-8000-00000000d003', 'DIETITIAN_NUTRITIONIST:STATE_LICENSE',
   'STATE_LICENSE', 'Dietitian/Nutritionist license', 'LDN-MA-20713',
   'Massachusetts Board of Registration of Dietitians and Nutritionists',
   'US', 'MA', date '2020-02-18', current_date + interval '22 months',
   'PENDING', 'd9000000-0000-4000-8000-00000000d015'),

  ('d1000000-0000-4000-8000-00000000d004', 'STRENGTH_CONDITIONING_COACH:NATIONAL_CERTIFICATION',
   'NATIONAL_CERTIFICATION', 'NSCA Certified Strength & Conditioning Specialist',
   'CSCS-7731902', 'NSCA',
   'US', null, date '2023-04-09', current_date + interval '16 months',
   'VERIFIED', 'd9000000-0000-4000-8000-00000000d016'),

  ('d1000000-0000-4000-8000-00000000d004', 'EXERCISE_PHYSIOLOGIST:NATIONAL_CERTIFICATION',
   'NATIONAL_CERTIFICATION', 'ACSM Certified Exercise Physiologist',
   'ACSM-EP-449021', 'ACSM',
   'US', null, date '2024-11-15', current_date + interval '25 months',
   'PENDING', 'd9000000-0000-4000-8000-00000000d017'),

  -- One card, shared by both of Jordan's certifications.
  ('d1000000-0000-4000-8000-00000000d004', 'CPR_AED',
   'CPR_AED', 'CPR/AED for the Professional Rescuer', 'AHA-88231047',
   'American Heart Association',
   'US', null, date '2025-09-30', current_date + interval '12 months',
   'VERIFIED', 'd9000000-0000-4000-8000-00000000d018');

-- ---------------------------------------------------------------------------
-- Insurance
-- ---------------------------------------------------------------------------

insert into insurance_policies (
  professional_id, insurance_type, carrier_name, policy_number,
  coverage_per_claim, coverage_aggregate, effective_date, expiration_date,
  certificate_document_id, status
) values
  ('d1000000-0000-4000-8000-00000000d001', 'PROFESSIONAL_LIABILITY',
   'Philadelphia Insurance Companies', 'PHPK-2214880',
   1000000, 3000000, current_date - interval '4 months',
   current_date + interval '8 months',
   'd9000000-0000-4000-8000-00000000d021', 'VERIFIED'),

  ('d1000000-0000-4000-8000-00000000d002', 'PROFESSIONAL_LIABILITY',
   'HPSO', 'HPSO-7741029',
   2000000, 6000000, current_date - interval '7 months',
   current_date + interval '5 months',
   'd9000000-0000-4000-8000-00000000d022', 'SUBMITTED'),

  ('d1000000-0000-4000-8000-00000000d003', 'PROFESSIONAL_LIABILITY',
   'HPSO', 'HPSO-6620418',
   2000000, 6000000, current_date - interval '3 months',
   current_date + interval '9 months',
   'd9000000-0000-4000-8000-00000000d023', 'VERIFIED'),

  ('d1000000-0000-4000-8000-00000000d004', 'PROFESSIONAL_LIABILITY',
   'Philadelphia Insurance Companies', 'PHPK-3309127',
   1000000, 3000000, current_date - interval '1 month',
   current_date + interval '11 months',
   'd9000000-0000-4000-8000-00000000d024', 'SUBMITTED');

-- ---------------------------------------------------------------------------
-- Capabilities, services, locations
-- ---------------------------------------------------------------------------

-- Each list stays inside what `capabilities.ts` allows those professions, so
-- the seeded records agree with the rules engine rather than quietly
-- contradicting it on screen. Priya's MEDICAL_NUTRITION_THERAPY is the one to
-- look at: it is in her union only because of the dietitian licence.
insert into professional_capabilities (professional_id, capability_code)
select d.professional_id, c.code
from (values
  ('d1000000-0000-4000-8000-00000000d001'::uuid, 'BODY_RECOMPOSITION'),
  ('d1000000-0000-4000-8000-00000000d001'::uuid, 'MUSCLE_GAIN'),
  ('d1000000-0000-4000-8000-00000000d001'::uuid, 'BEGINNERS'),
  ('d1000000-0000-4000-8000-00000000d001'::uuid, 'HIGH_BODY_FAT'),
  ('d1000000-0000-4000-8000-00000000d001'::uuid, 'LOW_LEAN_MASS'),

  ('d1000000-0000-4000-8000-00000000d002'::uuid, 'POST_INJURY'),
  ('d1000000-0000-4000-8000-00000000d002'::uuid, 'OLDER_ADULTS'),
  ('d1000000-0000-4000-8000-00000000d002'::uuid, 'MOBILITY_LIMITATION'),
  ('d1000000-0000-4000-8000-00000000d002'::uuid, 'LEAN_MASS_ASYMMETRY'),
  ('d1000000-0000-4000-8000-00000000d002'::uuid, 'POST_REHAB_STRENGTH'),
  ('d1000000-0000-4000-8000-00000000d002'::uuid, 'LOW_BMD_INDICATOR'),

  ('d1000000-0000-4000-8000-00000000d003'::uuid, 'OLDER_ADULTS'),
  ('d1000000-0000-4000-8000-00000000d003'::uuid, 'BONE_HEALTH'),
  ('d1000000-0000-4000-8000-00000000d003'::uuid, 'LOW_ALMI'),
  ('d1000000-0000-4000-8000-00000000d003'::uuid, 'DEXA_BONE_HEALTH'),
  ('d1000000-0000-4000-8000-00000000d003'::uuid, 'POST_REHAB_STRENGTH'),
  ('d1000000-0000-4000-8000-00000000d003'::uuid, 'MEDICAL_NUTRITION_THERAPY'),

  ('d1000000-0000-4000-8000-00000000d004'::uuid, 'ATHLETES'),
  ('d1000000-0000-4000-8000-00000000d004'::uuid, 'PERFORMANCE'),
  ('d1000000-0000-4000-8000-00000000d004'::uuid, 'OLDER_ADULTS'),
  ('d1000000-0000-4000-8000-00000000d004'::uuid, 'METABOLIC_HEALTH'),
  ('d1000000-0000-4000-8000-00000000d004'::uuid, 'DEXA_MUSCLE_GAIN'),
  ('d1000000-0000-4000-8000-00000000d004'::uuid, 'DEXA_BONE_HEALTH')
) as d(professional_id, code)
join capabilities c on c.code = d.code;

insert into service_offerings (
  professional_id, service_name, service_description, service_category,
  modality, duration_minutes, price_amount, free_intro_consult
) values
  ('d1000000-0000-4000-8000-00000000d001',
   'Body composition coaching block',
   'Twelve weeks of progressive strength training and nutrition coaching, built around your scan results and reassessed at the end of the block.',
   'TRAINING', 'HYBRID', 60, 180.00, true),

  ('d1000000-0000-4000-8000-00000000d002',
   'Orthopaedic physical therapy evaluation',
   'A full hour of one-to-one assessment covering movement, strength and loading tolerance, with a written plan for returning to training.',
   'REHABILITATION', 'IN_PERSON', 60, 225.00, false),

  ('d1000000-0000-4000-8000-00000000d003',
   'Bone and lean mass consultation',
   'A combined rehab and nutrition plan for rebuilding bone density and lean mass, reassessed against a follow-up scan.',
   'REHABILITATION', 'HYBRID', 75, 260.00, true),

  ('d1000000-0000-4000-8000-00000000d004',
   'Strength and conditioning block',
   'Twelve weeks of periodised strength work with objective testing at the start and end, for athletes and for adults rebuilding bone density.',
   'TRAINING', 'IN_PERSON', 60, 165.00, true);

insert into service_locations (
  professional_id, country, state, city, postal_code, address_1, service_mode
) values
  ('d1000000-0000-4000-8000-00000000d001', 'US', 'MA', 'Boston', '02118',
   '1391 Washington St', 'IN_PERSON'),
  ('d1000000-0000-4000-8000-00000000d002', 'US', 'MA', 'Cambridge', '02139',
   '625 Massachusetts Ave, Suite 210', 'IN_PERSON'),
  ('d1000000-0000-4000-8000-00000000d003', 'US', 'MA', 'Newton', '02458',
   '75 Washington St, Suite 3', 'IN_PERSON'),
  ('d1000000-0000-4000-8000-00000000d004', 'US', 'MA', 'Somerville', '02143',
   '14 Tyler St', 'IN_PERSON');

-- One row per profession per state, each pointing at the licence that
-- authorises it. Priya has two; Jordan's professions are unlicensed, so his
-- rows carry no credential.
insert into professional_service_jurisdictions (
  professional_id, country, state, profession_type, credential_id,
  virtual_allowed, in_person_allowed
)
select
  p.id, 'US', 'MA', t.profession_type,
  (select c.id from credentials c
    where c.professional_id = p.id
      and c.requirement_key = t.profession_type || ':STATE_LICENSE'
      and c.jurisdiction_state = 'MA'
    limit 1),
  'VIRTUAL' = any (p.service_modes),
  'IN_PERSON' = any (p.service_modes)
from professional_profiles p
cross join lateral unnest(p.profession_types) as t(profession_type)
where p.email like '%@demo.dexafit.invalid';

-- ---------------------------------------------------------------------------
-- Disclosures and attestations
-- ---------------------------------------------------------------------------

insert into compliance_disclosures (professional_id, disclosure_type, answer)
select p.id, d.disclosure_type, false
from professional_profiles p
cross join (values
  ('LICENSE_EVER_SUSPENDED_REVOKED_RESTRICTED'),
  ('CURRENT_PRACTICE_RESTRICTIONS'),
  ('PENDING_DISCIPLINARY_PROCEEDINGS'),
  ('EXCLUDED_FROM_FEDERAL_HEALTHCARE_PROGRAM')
) as d(disclosure_type)
where p.email like '%@demo.dexafit.invalid';

insert into attestations (
  professional_id, attestation_type, agreement_version, accepted, accepted_at
)
select p.id, a.attestation_type, '2026-09-draft-1', true, now() - interval '2 days'
from professional_profiles p
cross join (values
  ('INFORMATION_ACCURATE'),
  ('MAINTAIN_CREDENTIALS'),
  ('NOTIFY_STATUS_CHANGE'),
  ('PRACTICE_WITHIN_SCOPE'),
  ('NO_DIAGNOSIS_REPRESENTATION'),
  ('AUTHORIZED_USE_OF_HEALTH_INFORMATION'),
  ('NO_UNAUTHORIZED_SCAN_ACCESS'),
  ('MARKETPLACE_TERMS')
) as a(attestation_type)
where p.email like '%@demo.dexafit.invalid';

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------

insert into professional_applications (
  professional_id, status, completed_steps, manual_review_required,
  electronic_signature, signature_date, submitted_at
) values
  -- Everything verified: Approve should be visibly unlocked.
  ('d1000000-0000-4000-8000-00000000d001', 'CREDENTIAL_REVIEW',
   array['about','practice','credentials','insurance','who-you-help','services','locations','disclosures','attestations','review'],
   false, 'Marcus Whitfield', current_date - 3, now() - interval '3 days'),

  -- Licence still to verify: Approve stays visibly locked.
  ('d1000000-0000-4000-8000-00000000d002', 'CREDENTIAL_REVIEW',
   array['about','practice','credentials','insurance','who-you-help','services','locations','disclosures','attestations','review'],
   false, 'Elena Vasquez', current_date - 2, now() - interval '2 days'),

  -- One of two licences verified, so this cannot be approved until the second
  -- one is — which is the whole point of keying credentials per profession.
  ('d1000000-0000-4000-8000-00000000d003', 'CREDENTIAL_REVIEW',
   array['about','practice','credentials','insurance','who-you-help','services','locations','disclosures','attestations','review'],
   false, 'Priya Raghunathan', current_date - 1, now() - interval '1 day'),

  ('d1000000-0000-4000-8000-00000000d004', 'SUBMITTED',
   array['about','practice','credentials','insurance','who-you-help','services','locations','disclosures','attestations','review'],
   false, 'Jordan Ellis', current_date, now() - interval '4 hours');

insert into application_review_events (application_id, event_type, to_status, note)
select a.id, 'SUBMITTED', a.status,
       case when a.manual_review_required
            then 'Flagged for manual review on submission.' end
from professional_applications a
join professional_profiles p on p.id = a.professional_id
where p.email like '%@demo.dexafit.invalid';

commit;

\echo ''
\echo '  Seeded 4 demo applicants. Open /admin/professionals.'
\echo ''
