-- Authorization test suite.
--
-- Vitest covers the rules engine and the server actions, but the guarantees that
-- actually matter here live in the database: a provider must not be able to
-- approve or verify themselves even by talking straight to PostgREST. These
-- assertions exercise the real policies and triggers as the `authenticated`
-- role, the same way a signed-in user reaches the database.
--
-- Run against local Postgres or a Supabase branch:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
--
-- Any failed assertion raises and aborts. Silence means every check passed.
-- The suite rolls itself back, so it leaves no fixtures behind.

begin;

create or replace function assert(condition boolean, description text)
returns void language plpgsql as $$
begin
  if not condition then
    raise exception 'FAILED: %', description;
  end if;
  raise notice 'ok  %', description;
end;
$$;

-- Act as a signed-in user with the given id.
create or replace function act_as(user_id text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', user_id, true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('aaaa0000-0000-4000-8000-000000000001', 'provider@test.local'),
  ('bbbb0000-0000-4000-8000-000000000002', 'admin@test.local'),
  ('cccc0000-0000-4000-8000-000000000003', 'intruder@test.local');

update app_users set role = 'ADMIN' where id = 'bbbb0000-0000-4000-8000-000000000002';

insert into professional_profiles (id, user_id, profession_type, legal_first_name, legal_last_name, display_name)
values
  ('1111aaaa-0000-4000-8000-000000000001', 'aaaa0000-0000-4000-8000-000000000001',
   'PERSONAL_TRAINER', 'Provider', 'One', 'Provider One'),
  ('2222cccc-0000-4000-8000-000000000003', 'cccc0000-0000-4000-8000-000000000003',
   'PERSONAL_TRAINER', 'Intruder', 'Three', 'Intruder Three');

insert into professional_applications (id, professional_id)
values ('3333aaaa-0000-4000-8000-000000000001', '1111aaaa-0000-4000-8000-000000000001');

insert into credentials (id, professional_id, credential_type, credential_name, verification_status)
values ('5555aaaa-0000-4000-8000-000000000001', '1111aaaa-0000-4000-8000-000000000001',
        'NATIONAL_CERTIFICATION', 'NASM CPT', 'UNVERIFIED');

insert into insurance_policies (id, professional_id, insurance_type, carrier_name, policy_number)
values ('6666aaaa-0000-4000-8000-000000000001', '1111aaaa-0000-4000-8000-000000000001',
        'PROFESSIONAL_LIABILITY', 'Acme', 'POL-1');

insert into compliance_disclosures (id, professional_id, disclosure_type, answer)
values ('7777aaaa-0000-4000-8000-000000000001', '1111aaaa-0000-4000-8000-000000000001',
        'PENDING_DISCIPLINARY_PROCEEDINGS', true);

insert into storage.objects (bucket_id, name) values
  ('professional-documents', '1111aaaa-0000-4000-8000-000000000001/CREDENTIAL/mine.pdf'),
  ('professional-documents', '2222cccc-0000-4000-8000-000000000003/CREDENTIAL/theirs.pdf');

-- ---------------------------------------------------------------------------
-- A provider may not grant themselves anything
-- ---------------------------------------------------------------------------

set local role authenticated;
select act_as('aaaa0000-0000-4000-8000-000000000001');

update credentials set verification_status = 'VERIFIED', verified_by = auth.uid(),
       verified_at = now(), admin_notes = 'self approved'
 where id = '5555aaaa-0000-4000-8000-000000000001';
select assert(
  (select verification_status from credentials where id = '5555aaaa-0000-4000-8000-000000000001') = 'UNVERIFIED'
  and (select verified_by from credentials where id = '5555aaaa-0000-4000-8000-000000000001') is null
  and (select admin_notes from credentials where id = '5555aaaa-0000-4000-8000-000000000001') is null,
  'provider cannot verify their own credential');

update professional_profiles set marketplace_status = 'ACTIVE'
 where id = '1111aaaa-0000-4000-8000-000000000001';
select assert(
  (select marketplace_status from professional_profiles where id = '1111aaaa-0000-4000-8000-000000000001') = 'INACTIVE',
  'provider cannot activate their own marketplace listing');

update professional_applications set status = 'APPROVED', reviewed_by = auth.uid(),
       reviewed_at = now(), admin_notes = 'self approved'
 where id = '3333aaaa-0000-4000-8000-000000000001';
select assert(
  (select status from professional_applications where id = '3333aaaa-0000-4000-8000-000000000001') = 'DRAFT'
  and (select reviewed_by from professional_applications where id = '3333aaaa-0000-4000-8000-000000000001') is null
  and (select admin_notes from professional_applications where id = '3333aaaa-0000-4000-8000-000000000001') is null,
  'provider cannot approve their own application or write reviewer fields');

update insurance_policies set status = 'VERIFIED', verified_by = auth.uid()
 where id = '6666aaaa-0000-4000-8000-000000000001';
select assert(
  (select status from insurance_policies where id = '6666aaaa-0000-4000-8000-000000000001') = 'SUBMITTED',
  'provider cannot verify their own insurance');

update compliance_disclosures set resolved_by_admin = true, resolved_at = now()
 where id = '7777aaaa-0000-4000-8000-000000000001';
select assert(
  (select resolved_by_admin from compliance_disclosures where id = '7777aaaa-0000-4000-8000-000000000001') = false,
  'provider cannot resolve their own compliance disclosure');

do $$
begin
  update app_users set role = 'ADMIN' where id = auth.uid();
  if (select role from app_users where id = auth.uid()) = 'ADMIN' then
    raise exception 'FAILED: provider escalated to ADMIN';
  end if;
exception when insufficient_privilege or check_violation then
  null; -- rejected outright, which is also correct
end;
$$;
select assert(
  (select role from app_users where id = 'aaaa0000-0000-4000-8000-000000000001') = 'PROFESSIONAL',
  'provider cannot promote themselves to ADMIN');

-- A pre-verified credential cannot be smuggled in at insert time either.
insert into credentials (professional_id, credential_type, credential_name, verification_status)
values ('1111aaaa-0000-4000-8000-000000000001', 'CPR_AED', 'Smuggled', 'VERIFIED');
select assert(
  (select verification_status from credentials where credential_name = 'Smuggled') = 'UNVERIFIED',
  'provider cannot insert an already-verified credential');

-- ---------------------------------------------------------------------------
-- The audit trail is append-only and unforgeable
-- ---------------------------------------------------------------------------

do $$
begin
  insert into application_review_events (application_id, event_type, to_status, note, actor_id)
  values ('3333aaaa-0000-4000-8000-000000000001', 'APPROVED', 'APPROVED', 'forged', auth.uid());
exception when insufficient_privilege then
  null;
end;
$$;
select assert(
  (select count(*) from application_review_events where note = 'forged') = 0,
  'provider cannot forge a review event');

-- A provider still causes two events of their own, and the audit trail has to
-- keep them. Restricting forgery once cost us the submission record entirely.
insert into application_review_events (application_id, event_type, from_status, to_status, note)
values ('3333aaaa-0000-4000-8000-000000000001', 'SUBMITTED', 'DRAFT', 'SUBMITTED',
        'provider submitted');
select assert(
  (select count(*) from application_review_events where event_type = 'SUBMITTED') = 1,
  'provider can record their own submission');

do $$
begin
  insert into application_review_events (application_id, event_type, to_status, note, actor_id)
  values ('3333aaaa-0000-4000-8000-000000000001', 'SUBMITTED', 'SUBMITTED', 'self-attributed',
          auth.uid());
exception when insufficient_privilege then
  null;
end;
$$;
select assert(
  (select count(*) from application_review_events where note = 'self-attributed') = 0,
  'provider cannot name themselves as the actor on an event');

-- ---------------------------------------------------------------------------
-- Tenant isolation
-- ---------------------------------------------------------------------------

select assert(
  (select count(*) from professional_profiles where id = '2222cccc-0000-4000-8000-000000000003') = 0,
  'provider cannot read another professional''s profile');

select assert(
  (select count(*) from storage.objects where name like '2222cccc%') = 0,
  'provider cannot list another professional''s documents');

select assert(
  (select count(*) from storage.objects where name like '1111aaaa%') = 1,
  'provider can list their own documents');

do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('professional-documents', '2222cccc-0000-4000-8000-000000000003/CREDENTIAL/planted.pdf');
exception when insufficient_privilege then
  null;
end;
$$;
select assert(
  (select count(*) from storage.objects where name like '%planted%') = 0,
  'provider cannot write into another professional''s document folder');

do $$
begin
  insert into credentials (professional_id, credential_type, credential_name)
  values ('2222cccc-0000-4000-8000-000000000003', 'STATE_LICENSE', 'planted');
exception when insufficient_privilege then
  null;
end;
$$;
select assert(
  (select count(*) from credentials where credential_name = 'planted') = 0,
  'provider cannot attach a credential to another professional');

-- ---------------------------------------------------------------------------
-- Legitimate provider actions still work
-- ---------------------------------------------------------------------------

update credentials set credential_number = 'NASM-12345', expiration_date = '2030-01-01'
 where id = '5555aaaa-0000-4000-8000-000000000001';
select assert(
  (select credential_number from credentials where id = '5555aaaa-0000-4000-8000-000000000001') = 'NASM-12345',
  'provider can edit their own credential details');

update professional_applications set manual_review_required = true, status = 'SUBMITTED', submitted_at = now()
 where id = '3333aaaa-0000-4000-8000-000000000001';
select assert(
  (select status from professional_applications where id = '3333aaaa-0000-4000-8000-000000000001') = 'SUBMITTED',
  'provider can submit their own application');

update professional_applications set manual_review_required = false
 where id = '3333aaaa-0000-4000-8000-000000000001';
select assert(
  (select manual_review_required from professional_applications where id = '3333aaaa-0000-4000-8000-000000000001') = true,
  'provider cannot switch manual review back off');

-- ---------------------------------------------------------------------------
-- The reviewer can do their job
-- ---------------------------------------------------------------------------

select act_as('bbbb0000-0000-4000-8000-000000000002');

update credentials set verification_status = 'VERIFIED', verified_by = auth.uid(),
       verified_at = now(), admin_notes = 'confirmed with the board'
 where id = '5555aaaa-0000-4000-8000-000000000001';
select assert(
  (select verification_status from credentials where id = '5555aaaa-0000-4000-8000-000000000001') = 'VERIFIED',
  'admin can verify a credential');

update compliance_disclosures set resolved_by_admin = true where id = '7777aaaa-0000-4000-8000-000000000001';
update insurance_policies set status = 'VERIFIED' where id = '6666aaaa-0000-4000-8000-000000000001';
update professional_applications set status = 'APPROVED', reviewed_by = auth.uid(), reviewed_at = now()
 where id = '3333aaaa-0000-4000-8000-000000000001';
update professional_profiles set marketplace_status = 'ACTIVE'
 where id = '1111aaaa-0000-4000-8000-000000000001';
select assert(
  (select status from professional_applications where id = '3333aaaa-0000-4000-8000-000000000001') = 'APPROVED'
  and (select marketplace_status from professional_profiles where id = '1111aaaa-0000-4000-8000-000000000001') = 'ACTIVE',
  'admin can approve and activate a listing');

-- ---------------------------------------------------------------------------
-- Editing an approved application stands the listing back down
-- ---------------------------------------------------------------------------

select act_as('aaaa0000-0000-4000-8000-000000000001');

update credentials set credential_number = 'SWAPPED-99999'
 where id = '5555aaaa-0000-4000-8000-000000000001';
select assert(
  (select verification_status from credentials where id = '5555aaaa-0000-4000-8000-000000000001') = 'PENDING'
  and (select verified_by from credentials where id = '5555aaaa-0000-4000-8000-000000000001') is null,
  'editing a verified credential drops it back to pending');

select assert(
  (select admin_notes from credentials where id = '5555aaaa-0000-4000-8000-000000000001') = 'confirmed with the board',
  'the reviewer''s notes survive a provider edit');

update professional_applications set status = 'CREDENTIAL_REVIEW'
 where id = '3333aaaa-0000-4000-8000-000000000001';
update professional_profiles set marketplace_status = 'INACTIVE'
 where id = '1111aaaa-0000-4000-8000-000000000001';
insert into application_review_events (application_id, event_type, from_status, to_status, note)
values ('3333aaaa-0000-4000-8000-000000000001', 'REOPENED_FOR_REVIEW', 'APPROVED', 'CREDENTIAL_REVIEW',
        'Credential updated after approval');
select assert(
  (select status from professional_applications where id = '3333aaaa-0000-4000-8000-000000000001') = 'CREDENTIAL_REVIEW'
  and (select marketplace_status from professional_profiles where id = '1111aaaa-0000-4000-8000-000000000001') = 'INACTIVE',
  'a post-approval edit reopens review and stands the listing down');

select assert(
  (select count(*) from application_review_events where event_type = 'REOPENED_FOR_REVIEW') = 1,
  'the reopen event is recorded');

update application_review_events set note = 'rewritten' where event_type = 'REOPENED_FOR_REVIEW';
select assert(
  (select count(*) from application_review_events where note = 'rewritten') = 0,
  'audit history cannot be rewritten');

delete from application_review_events;
select assert(
  (select count(*) from application_review_events) > 0,
  'audit history cannot be deleted');

reset role;
rollback;
