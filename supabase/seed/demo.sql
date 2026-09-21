-- Demo providers for a walkthrough.
--
--   npm run seed:demo
--
-- Four fictional applicants chosen to show the parts of the credentialing
-- engine that distinguish this from a form:
--
--   Marcus Whitfield    personal trainer      ready to approve
--   Elena Vasquez       physical therapist    state licence, in credential review
--   Rachel Kim          LICSW                 licensed, independently listable
--   Daniel Oyelaran     LCSW                  the same profession family, but
--                                             NOT independently listable, so it
--                                             is forced to manual review
--
-- The last two are the point of the demo: same discipline, different licence,
-- different outcome, decided by rule rather than by whoever is reviewing.
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
-- so everything below goes with these four rows.
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

delete from auth.users where id in (
  'd0000000-0000-4000-8000-00000000d001',
  'd0000000-0000-4000-8000-00000000d002',
  'd0000000-0000-4000-8000-00000000d003',
  'd0000000-0000-4000-8000-00000000d004'
);

alter table application_review_events enable trigger reject_review_event_mutation;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, email_confirmed_at) values
  ('d0000000-0000-4000-8000-00000000d001', 'marcus.whitfield@demo.dexafit.invalid', now()),
  ('d0000000-0000-4000-8000-00000000d002', 'elena.vasquez@demo.dexafit.invalid', now()),
  ('d0000000-0000-4000-8000-00000000d003', 'rachel.kim@demo.dexafit.invalid', now()),
  ('d0000000-0000-4000-8000-00000000d004', 'daniel.oyelaran@demo.dexafit.invalid', now());

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

insert into professional_profiles (
  id, user_id, legal_first_name, legal_last_name, display_name,
  profession_type, professional_title, bio, years_experience, languages,
  email, phone, joining_as, practice_name,
  business_email, business_phone, service_modes, accepting_new_clients,
  marketplace_status
) values
  ('d1000000-0000-4000-8000-00000000d001', 'd0000000-0000-4000-8000-00000000d001',
   'Marcus', 'Whitfield', 'Marcus Whitfield',
   'PERSONAL_TRAINER', 'NASM-CPT, CES',
   'I work with adults who want to change their body composition without giving up the rest of their life. Most of my clients come to me after a scan showing low lean mass or high visceral fat, and we build from there: progressive strength work, realistic nutrition habits, and a re-scan every twelve weeks so the plan answers to data instead of to how the week felt.',
   9, array['English'],
   'marcus.whitfield@demo.dexafit.invalid', '+16175550142',
   'INDIVIDUAL', 'Whitfield Strength',
   'hello@demo.dexafit.invalid', '+16175550142',
   array['IN_PERSON', 'VIRTUAL'], true, 'INACTIVE'),

  ('d1000000-0000-4000-8000-00000000d002', 'd0000000-0000-4000-8000-00000000d002',
   'Elena', 'Vasquez', 'Dr. Elena Vasquez, PT, DPT',
   'PHYSICAL_THERAPIST', 'PT, DPT, OCS',
   'Orthopaedic physical therapist focused on return to loading after injury. I see a lot of people who have been told to rest and have lost more muscle than they realise; a DEXA scan makes that concrete and gives us something to rebuild against. I treat one patient at a time, for a full hour, and I do not double-book.',
   14, array['English', 'Spanish'],
   'elena.vasquez@demo.dexafit.invalid', '+16175550168',
   'ORGANIZATION_MEMBER', 'Charles River Orthopedic PT',
   'front.desk@demo.dexafit.invalid', '+16175550100',
   array['IN_PERSON'], true, 'INACTIVE'),

  ('d1000000-0000-4000-8000-00000000d003', 'd0000000-0000-4000-8000-00000000d003',
   'Rachel', 'Kim', 'Rachel Kim, LICSW',
   'LICSW', 'LICSW',
   'Independent clinical social worker. I work with adults around disordered eating, body image and the anxiety that often arrives alongside a new health metric. Body composition data can be genuinely useful and it can also become something to hurt yourself with; a good part of my work is helping people tell the difference.',
   11, array['English', 'Korean'],
   'rachel.kim@demo.dexafit.invalid', '+16175550177',
   'INDIVIDUAL', 'Rachel Kim Counseling',
   'rachel.kim@demo.dexafit.invalid', '+16175550177',
   array['VIRTUAL', 'IN_PERSON'], true, 'INACTIVE'),

  ('d1000000-0000-4000-8000-00000000d004', 'd0000000-0000-4000-8000-00000000d004',
   'Daniel', 'Oyelaran', 'Daniel Oyelaran, LCSW',
   'LCSW', 'LCSW',
   'Clinical social worker working with men around weight, shame and health avoidance. I practise under supervision at a group practice in Somerville and see clients both in person and remotely across Massachusetts.',
   4, array['English'],
   'daniel.oyelaran@demo.dexafit.invalid', '+16175550193',
   'ORGANIZATION_MEMBER', 'Somerville Behavioral Health',
   'intake@demo.dexafit.invalid', '+16175550110',
   array['VIRTUAL', 'IN_PERSON'], true, 'INACTIVE');

-- The LCSW is the restricted case: supervised practice, no independent listing.
update professional_profiles set
  supervisor_name = 'Priya Raghunathan, LICSW',
  supervisor_license_type = 'LICSW',
  supervisor_license_number = 'SW-MA-118204',
  supervising_organization = 'Somerville Behavioral Health'
 where id = 'd1000000-0000-4000-8000-00000000d004';

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
  ('d9000000-0000-4000-8000-00000000d003'::uuid, 'd1000000-0000-4000-8000-00000000d003'::uuid, 'PROFILE_PHOTO', 'rkim-headshot.pdf'),
  ('d9000000-0000-4000-8000-00000000d004'::uuid, 'd1000000-0000-4000-8000-00000000d004'::uuid, 'PROFILE_PHOTO', 'doyelaran-headshot.pdf'),
  ('d9000000-0000-4000-8000-00000000d011'::uuid, 'd1000000-0000-4000-8000-00000000d001'::uuid, 'CREDENTIAL', 'nasm-cpt-certificate.pdf'),
  ('d9000000-0000-4000-8000-00000000d012'::uuid, 'd1000000-0000-4000-8000-00000000d001'::uuid, 'CREDENTIAL', 'aha-cpr-aed-card.pdf'),
  ('d9000000-0000-4000-8000-00000000d013'::uuid, 'd1000000-0000-4000-8000-00000000d002'::uuid, 'CREDENTIAL', 'ma-pt-license.pdf'),
  ('d9000000-0000-4000-8000-00000000d014'::uuid, 'd1000000-0000-4000-8000-00000000d003'::uuid, 'CREDENTIAL', 'ma-licsw-license.pdf'),
  ('d9000000-0000-4000-8000-00000000d015'::uuid, 'd1000000-0000-4000-8000-00000000d004'::uuid, 'CREDENTIAL', 'ma-lcsw-license.pdf'),
  ('d9000000-0000-4000-8000-00000000d021'::uuid, 'd1000000-0000-4000-8000-00000000d001'::uuid, 'INSURANCE_CERTIFICATE', 'coi-whitfield.pdf'),
  ('d9000000-0000-4000-8000-00000000d022'::uuid, 'd1000000-0000-4000-8000-00000000d002'::uuid, 'INSURANCE_CERTIFICATE', 'coi-charles-river.pdf'),
  ('d9000000-0000-4000-8000-00000000d023'::uuid, 'd1000000-0000-4000-8000-00000000d003'::uuid, 'INSURANCE_CERTIFICATE', 'coi-rkim.pdf'),
  ('d9000000-0000-4000-8000-00000000d024'::uuid, 'd1000000-0000-4000-8000-00000000d004'::uuid, 'INSURANCE_CERTIFICATE', 'coi-somerville.pdf')
) as d(id, professional_id, document_type, filename);

-- professional_profiles references professional_documents and documents
-- reference profiles, so the photo is attached once both rows exist.
update professional_profiles p
   set profile_photo_document_id = d.id
  from professional_documents d
 where d.professional_id = p.id
   and d.document_type = 'PROFILE_PHOTO'
   and p.id in (
     'd1000000-0000-4000-8000-00000000d001',
     'd1000000-0000-4000-8000-00000000d002',
     'd1000000-0000-4000-8000-00000000d003',
     'd1000000-0000-4000-8000-00000000d004'
   );

-- ---------------------------------------------------------------------------
-- Credentials
-- ---------------------------------------------------------------------------

insert into credentials (
  professional_id, credential_type, credential_name, credential_number,
  issuing_authority, jurisdiction_country, jurisdiction_state,
  issue_date, expiration_date, verification_status, document_id
) values
  ('d1000000-0000-4000-8000-00000000d001', 'NATIONAL_CERTIFICATION',
   'NASM Certified Personal Trainer', 'NASM-1184023', 'NASM',
   'US', null, date '2024-03-11', current_date + interval '14 months',
   'VERIFIED', 'd9000000-0000-4000-8000-00000000d011'),

  ('d1000000-0000-4000-8000-00000000d001', 'CPR_AED',
   'CPR/AED for the Professional Rescuer', 'AHA-77120934',
   'American Heart Association',
   'US', null, date '2025-06-02', current_date + interval '9 months',
   'VERIFIED', 'd9000000-0000-4000-8000-00000000d012'),

  ('d1000000-0000-4000-8000-00000000d002', 'STATE_LICENSE',
   'Physical Therapist license', 'PT-MA-42187',
   'Massachusetts Board of Registration in Allied Health Professions',
   'US', 'MA', date '2019-08-20', current_date + interval '20 months',
   'PENDING', 'd9000000-0000-4000-8000-00000000d013'),

  ('d1000000-0000-4000-8000-00000000d003', 'STATE_LICENSE',
   'LICSW license', 'SW-MA-097411',
   'Massachusetts Board of Registration of Social Workers',
   'US', 'MA', date '2018-01-15', current_date + interval '17 months',
   'PENDING', 'd9000000-0000-4000-8000-00000000d014'),

  ('d1000000-0000-4000-8000-00000000d004', 'STATE_LICENSE',
   'LCSW license', 'SW-MA-155908',
   'Massachusetts Board of Registration of Social Workers',
   'US', 'MA', date '2023-09-05', current_date + interval '11 months',
   'PENDING', 'd9000000-0000-4000-8000-00000000d015');

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
   'CPH & Associates', 'CPH-5519023',
   1000000, 3000000, current_date - interval '2 months',
   current_date + interval '10 months',
   'd9000000-0000-4000-8000-00000000d023', 'SUBMITTED'),

  ('d1000000-0000-4000-8000-00000000d004', 'PROFESSIONAL_LIABILITY',
   'CPH & Associates', 'CPH-5610447',
   1000000, 3000000, current_date - interval '1 month',
   current_date + interval '11 months',
   'd9000000-0000-4000-8000-00000000d024', 'SUBMITTED');

-- ---------------------------------------------------------------------------
-- Capabilities, services, locations
-- ---------------------------------------------------------------------------

-- Each list stays inside what `capabilities.ts` allows that profession, so the
-- seeded records agree with the rules engine rather than quietly contradicting
-- it on screen.
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

  ('d1000000-0000-4000-8000-00000000d003'::uuid, 'WOMENS_HEALTH'),
  ('d1000000-0000-4000-8000-00000000d003'::uuid, 'WEIGHT_MANAGEMENT'),
  ('d1000000-0000-4000-8000-00000000d003'::uuid, 'PSYCHOTHERAPY'),
  ('d1000000-0000-4000-8000-00000000d003'::uuid, 'GENERAL_LONGEVITY'),

  ('d1000000-0000-4000-8000-00000000d004'::uuid, 'MENS_HEALTH'),
  ('d1000000-0000-4000-8000-00000000d004'::uuid, 'BEGINNERS'),
  ('d1000000-0000-4000-8000-00000000d004'::uuid, 'PSYCHOTHERAPY'),
  ('d1000000-0000-4000-8000-00000000d004'::uuid, 'GENERAL_LONGEVITY')
) as d(professional_id, code)
join capabilities c on c.code = d.code;

-- ---------------------------------------------------------------------------

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
   'Individual therapy',
   'Weekly fifty-minute sessions for adults working through disordered eating, body image and health anxiety.',
   'MENTAL_HEALTH', 'HYBRID', 50, 190.00, true),

  ('d1000000-0000-4000-8000-00000000d004',
   'Individual counseling',
   'Weekly sessions for men working on weight, shame and avoidance of medical care. Practice supervised by a LICSW.',
   'MENTAL_HEALTH', 'HYBRID', 50, 150.00, true);

insert into service_locations (
  professional_id, country, state, city, postal_code, address_1, service_mode
) values
  ('d1000000-0000-4000-8000-00000000d001', 'US', 'MA', 'Boston', '02118',
   '1391 Washington St', 'IN_PERSON'),
  ('d1000000-0000-4000-8000-00000000d002', 'US', 'MA', 'Cambridge', '02139',
   '625 Massachusetts Ave, Suite 210', 'IN_PERSON'),
  ('d1000000-0000-4000-8000-00000000d003', 'US', 'MA', 'Brookline', '02446',
   '1180 Beacon St, Suite 4C', 'IN_PERSON'),
  ('d1000000-0000-4000-8000-00000000d004', 'US', 'MA', 'Somerville', '02144',
   '240 Elm St, Floor 2', 'IN_PERSON');

-- ---------------------------------------------------------------------------
-- Disclosures and attestations
-- ---------------------------------------------------------------------------

-- Everyone answers every compliance question, all "no".
insert into compliance_disclosures (professional_id, disclosure_type, answer)
select p.id, d.disclosure_type, false
from professional_profiles p
cross join (values
  ('LICENSE_EVER_SUSPENDED_REVOKED_RESTRICTED'),
  ('CURRENT_PRACTICE_RESTRICTIONS'),
  ('PENDING_DISCIPLINARY_PROCEEDINGS'),
  ('EXCLUDED_FROM_FEDERAL_HEALTHCARE_PROGRAM')
) as d(disclosure_type)
where p.id in (
  'd1000000-0000-4000-8000-00000000d001',
  'd1000000-0000-4000-8000-00000000d002',
  'd1000000-0000-4000-8000-00000000d003',
  'd1000000-0000-4000-8000-00000000d004'
);

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
where p.id in (
  'd1000000-0000-4000-8000-00000000d001',
  'd1000000-0000-4000-8000-00000000d002',
  'd1000000-0000-4000-8000-00000000d003',
  'd1000000-0000-4000-8000-00000000d004'
);

-- ---------------------------------------------------------------------------
-- Applications
--
-- Placed last so every dependency exists. The four sit at different points in
-- the queue, which is what makes a walkthrough of the admin side worth doing.
-- ---------------------------------------------------------------------------

insert into professional_applications (
  professional_id, status, completed_steps, manual_review_required,
  electronic_signature, signature_date, submitted_at
) values
  -- Everything verified: this one should show Approve unlocked.
  ('d1000000-0000-4000-8000-00000000d001', 'CREDENTIAL_REVIEW',
   array['about','practice','credentials','insurance','who-you-help','services','locations','disclosures','attestations','review'],
   false, 'Marcus Whitfield', current_date - 3, now() - interval '3 days'),

  -- Licence still to verify: Approve stays locked until a reviewer acts.
  ('d1000000-0000-4000-8000-00000000d002', 'CREDENTIAL_REVIEW',
   array['about','practice','credentials','insurance','who-you-help','services','locations','disclosures','attestations','review'],
   false, 'Elena Vasquez', current_date - 2, now() - interval '2 days'),

  ('d1000000-0000-4000-8000-00000000d003', 'SUBMITTED',
   array['about','practice','credentials','insurance','who-you-help','services','locations','disclosures','attestations','review'],
   false, 'Rachel Kim', current_date - 1, now() - interval '1 day'),

  -- Flagged at submission because an LCSW cannot be listed independently.
  ('d1000000-0000-4000-8000-00000000d004', 'SUBMITTED',
   array['about','practice','credentials','insurance','who-you-help','services','locations','disclosures','attestations','review'],
   true, 'Daniel Oyelaran', current_date, now() - interval '4 hours');

insert into application_review_events (application_id, event_type, to_status, note)
select a.id, 'SUBMITTED', a.status,
       case when a.manual_review_required
            then 'Flagged for manual review on submission.' end
from professional_applications a
where a.professional_id in (
  'd1000000-0000-4000-8000-00000000d001',
  'd1000000-0000-4000-8000-00000000d002',
  'd1000000-0000-4000-8000-00000000d003',
  'd1000000-0000-4000-8000-00000000d004'
);

commit;

\echo ''
\echo '  Seeded 4 demo applicants. Open /admin/professionals.'
\echo ''
