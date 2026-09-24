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

insert into professional_profiles (id, user_id, profession_types, legal_first_name, legal_last_name, display_name)
values
  ('1111aaaa-0000-4000-8000-000000000001', 'aaaa0000-0000-4000-8000-000000000001',
   array['PERSONAL_TRAINER'], 'Provider', 'One', 'Provider One'),
  ('2222cccc-0000-4000-8000-000000000003', 'cccc0000-0000-4000-8000-000000000003',
   array['PERSONAL_TRAINER'], 'Intruder', 'Three', 'Intruder Three');

insert into professional_applications (id, professional_id)
values ('3333aaaa-0000-4000-8000-000000000001', '1111aaaa-0000-4000-8000-000000000001');

insert into credentials (id, professional_id, credential_type, requirement_key, credential_name, verification_status)
values ('5555aaaa-0000-4000-8000-000000000001', '1111aaaa-0000-4000-8000-000000000001',
        'NATIONAL_CERTIFICATION', 'PERSONAL_TRAINER:NATIONAL_CERTIFICATION',
        'NASM CPT', 'UNVERIFIED');

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

-- ---------------------------------------------------------------------------
-- Bucket configuration
-- ---------------------------------------------------------------------------
--
-- Checked before dropping to the provider role, because storage.buckets is not
-- readable by `authenticated` — asserted from there it would read NULL and pass
-- for the wrong reason.

select assert(
  (select public from storage.buckets where id = 'professional-photos') is true,
  'the photo bucket is public, which is the point of it');

select assert(
  (select public from storage.buckets where id = 'professional-documents') is false,
  'the credential bucket is NOT public');

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
insert into credentials (professional_id, credential_type, requirement_key, credential_name, verification_status)
values ('1111aaaa-0000-4000-8000-000000000001', 'CPR_AED', 'CPR_AED', 'Smuggled', 'VERIFIED');
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

-- Every review state a reopen can land on must be writable, or the edit
-- disappears from the trail for that state only.
insert into application_review_events (application_id, event_type, from_status, to_status, note)
values ('3333aaaa-0000-4000-8000-000000000001', 'REOPENED_FOR_REVIEW', 'COMPLIANCE_REVIEW',
        'COMPLIANCE_REVIEW', 'reopened from compliance review');
select assert(
  (select count(*) from application_review_events
    where note = 'reopened from compliance review') = 1,
  'provider can record a reopen while in compliance review');

do $$
begin
  insert into application_review_events (application_id, event_type, to_status, note)
  values ('3333aaaa-0000-4000-8000-000000000001', 'REOPENED_FOR_REVIEW', 'APPROVED',
          'claims approval');
exception when insufficient_privilege then
  null;
end;
$$;
select assert(
  (select count(*) from application_review_events where note = 'claims approval') = 0,
  'provider cannot record an event landing on APPROVED');

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

-- ---------------------------------------------------------------------------
-- The public photo bucket holds photos and nothing else
-- ---------------------------------------------------------------------------
--
-- The marketplace displays provider photos, so that bucket is public. Every
-- credential document is one bucket away from being published at a permanent
-- unauthenticated URL, and the thing standing in between is the insert policy
-- rather than application code. These assertions are that policy's proof.

-- The one that matters: a credential cannot be smuggled into the public bucket
-- even by its rightful owner, because the path says CREDENTIAL.
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('professional-photos',
          '1111aaaa-0000-4000-8000-000000000001/CREDENTIAL/smuggled.pdf');
exception when insufficient_privilege then
  null;
end;
$$;
select assert(
  (select count(*) from storage.objects where name like '%smuggled%') = 0,
  'a CREDENTIAL cannot be written into the public photo bucket');

do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('professional-photos',
          '1111aaaa-0000-4000-8000-000000000001/INSURANCE_CERTIFICATE/smuggled2.pdf');
exception when insufficient_privilege then
  null;
end;
$$;
select assert(
  (select count(*) from storage.objects where name like '%smuggled2%') = 0,
  'an INSURANCE_CERTIFICATE cannot be written into the public photo bucket');

-- Ownership still applies inside the public bucket: public to read is not
-- public to write.
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('professional-photos',
          '2222cccc-0000-4000-8000-000000000003/PROFILE_PHOTO/planted3.png');
exception when insufficient_privilege then
  null;
end;
$$;
select assert(
  (select count(*) from storage.objects where name like '%planted3%') = 0,
  'provider cannot write a photo into another professional''s folder');

-- And the legitimate case still works, or the guard is just breakage.
insert into storage.objects (bucket_id, name)
values ('professional-photos',
        '1111aaaa-0000-4000-8000-000000000001/PROFILE_PHOTO/mine.png');
select assert(
  (select count(*) from storage.objects where name like '%PROFILE_PHOTO/mine.png') = 1,
  'a provider can still upload their own profile photo');

-- The document row cannot claim to be public when it is not a photo, so the
-- table and the bucket policy cannot drift apart.
do $$
begin
  insert into professional_documents
    (professional_id, document_type, bucket, storage_key, original_filename,
     mime_type, file_size)
  values ('1111aaaa-0000-4000-8000-000000000001', 'CREDENTIAL', 'professional-photos',
          '1111aaaa-0000-4000-8000-000000000001/CREDENTIAL/lying.pdf', 'lying.pdf',
          'application/pdf', 1024);
exception when check_violation or insufficient_privilege then
  null;
end;
$$;
select assert(
  (select count(*) from professional_documents where original_filename = 'lying.pdf') = 0,
  'a credential document row cannot claim to live in the public bucket');

do $$
begin
  insert into credentials (professional_id, credential_type, requirement_key, credential_name)
  values ('2222cccc-0000-4000-8000-000000000003', 'STATE_LICENSE',
          'PHYSICAL_THERAPIST:STATE_LICENSE', 'planted');
exception when insufficient_privilege then
  null;
end;
$$;
select assert(
  (select count(*) from credentials where credential_name = 'planted') = 0,
  'provider cannot attach a credential to another professional');

-- ---------------------------------------------------------------------------
-- A credential must say which requirement it satisfies
-- ---------------------------------------------------------------------------
--
-- Readiness matches on requirement_key and never on credential_type, because a
-- physical therapist who is also a dietitian holds two state licences and
-- neither satisfies the other. A row with no key would match no requirement at
-- all, so the database refuses to store one.

do $$
begin
  insert into credentials (professional_id, credential_type, credential_name)
  values ('1111aaaa-0000-4000-8000-000000000001', 'CPR_AED', 'keyless');
exception when not_null_violation then
  null;
end;
$$;
select assert(
  (select count(*) from credentials where credential_name = 'keyless') = 0,
  'a credential cannot be stored without a requirement_key');

do $$
begin
  insert into credentials (professional_id, credential_type, requirement_key, credential_name)
  values ('1111aaaa-0000-4000-8000-000000000001', 'CPR_AED', '   ', 'blank-key');
exception when check_violation then
  null;
end;
$$;
select assert(
  (select count(*) from credentials where credential_name = 'blank-key') = 0,
  'a blank requirement_key is refused as well as a null one');

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
  exists (
    select 1 from application_review_events
    where event_type = 'REOPENED_FOR_REVIEW'
      and note = 'Credential updated after approval'
  ),
  'the reopen event is recorded');

update application_review_events set note = 'rewritten' where event_type = 'REOPENED_FOR_REVIEW';
select assert(
  (select count(*) from application_review_events where note = 'rewritten') = 0,
  'audit history cannot be rewritten');

delete from application_review_events;
select assert(
  (select count(*) from application_review_events) > 0,
  'audit history cannot be deleted');

-- ---------------------------------------------------------------------------
-- The verified recipient address
-- ---------------------------------------------------------------------------
--
-- professional_profiles.email is self-entered. Anything sent to a provider
-- about their application must go to the confirmed auth address instead, and
-- only the provider themselves or an admin may resolve it.

-- The section above leaves us as `authenticated`; fixtures are set up as the
-- owner.
reset role;

update auth.users set email_confirmed_at = now()
 where id in ('aaaa0000-0000-4000-8000-000000000001',
              'cccc0000-0000-4000-8000-000000000003');

-- A plausible-looking address typed into the form by someone who does not own
-- the account. It must never become a recipient.
update professional_profiles set email = 'attacker@evil.test'
 where id = '1111aaaa-0000-4000-8000-000000000001';

set local role authenticated;

select act_as('aaaa0000-0000-4000-8000-000000000001');
select assert(
  verified_auth_email('1111aaaa-0000-4000-8000-000000000001') = 'provider@test.local',
  'a provider resolves their own confirmed auth address');

select assert(
  verified_auth_email('1111aaaa-0000-4000-8000-000000000001')
    is distinct from (select email from professional_profiles
                      where id = '1111aaaa-0000-4000-8000-000000000001'),
  'the resolved address is the auth address, not the self-entered one');

select act_as('cccc0000-0000-4000-8000-000000000003');
select assert(
  verified_auth_email('1111aaaa-0000-4000-8000-000000000001') is null,
  'one provider cannot resolve another provider address');

select act_as('bbbb0000-0000-4000-8000-000000000002');
select assert(
  verified_auth_email('1111aaaa-0000-4000-8000-000000000001') = 'provider@test.local',
  'an admin resolves a provider address in order to notify them');

reset role;

-- The body's filter already returns nothing to an anonymous caller, but a
-- function that reads auth.users with definer rights should not be reachable
-- unauthenticated at all. Supabase's default privileges grant anon EXECUTE on
-- new public functions, so this has to be revoked by name and stay revoked.
select assert(
  not has_function_privilege('anon', 'verified_auth_email(uuid)', 'EXECUTE'),
  'an anonymous caller cannot execute the address lookup');

-- An address nobody has ever confirmed proves nothing about who holds it.
update auth.users set email_confirmed_at = null
 where id = 'aaaa0000-0000-4000-8000-000000000001';

set local role authenticated;
select act_as('aaaa0000-0000-4000-8000-000000000001');
select assert(
  verified_auth_email('1111aaaa-0000-4000-8000-000000000001') is null,
  'an unconfirmed address is not a valid recipient');
reset role;

update auth.users set email_confirmed_at = now()
 where id = 'aaaa0000-0000-4000-8000-000000000001';

-- The admin UI reads app_users.email; it used to be copied once at signup and
-- then drift forever.
update auth.users set email = 'provider-new@test.local'
 where id = 'aaaa0000-0000-4000-8000-000000000001';
select assert(
  (select email from app_users where id = 'aaaa0000-0000-4000-8000-000000000001')
    = 'provider-new@test.local',
  'a changed auth address propagates to the app_users mirror');

update auth.users set email = 'provider@test.local'
 where id = 'aaaa0000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- search_path hijacking
-- ---------------------------------------------------------------------------
--
-- PostgreSQL searches the session's temporary schema first for relation names
-- whenever pg_temp is not itself listed in a function's search_path. A
-- SECURITY DEFINER function reading an unqualified `app_users` therefore
-- resolved to a caller-created temp table in preference to the real one, which
-- made is_admin() return true for anyone who could run `create temp table`.
--
-- These assertions create exactly those shadow relations and confirm the real
-- objects still win. They run last, and drop the shadows immediately, because
-- while a shadow exists every later statement would read it too.

reset role;
set local role authenticated;
select act_as('aaaa0000-0000-4000-8000-000000000001');

create temp table app_users (id uuid, email text, role text) on commit drop;
insert into app_users values
  ('aaaa0000-0000-4000-8000-000000000001', 'attacker@test.local', 'ADMIN');
select assert(
  not is_admin(),
  'a shadow app_users table cannot make a provider an admin');
drop table pg_temp.app_users;

create temp table professional_profiles (id uuid, user_id uuid, email text)
  on commit drop;
insert into professional_profiles values
  ('2222cccc-0000-4000-8000-000000000003',
   'aaaa0000-0000-4000-8000-000000000001', 'attacker@test.local');
select assert(
  not owns_professional('2222cccc-0000-4000-8000-000000000003'),
  'a shadow professional_profiles table cannot forge ownership');
drop table pg_temp.professional_profiles;

reset role;

-- Every definer function must name pg_temp explicitly, or it is exposed the
-- same way the moment someone adds an unqualified read to it.
select assert(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not coalesce(array_to_string(p.proconfig, ',') like '%pg_temp%', false)
  ),
  'every SECURITY DEFINER function pins pg_temp in its search_path');

-- ---------------------------------------------------------------------------
-- The expiry-warning job
-- ---------------------------------------------------------------------------
--
-- The job runs with no user session, so it cannot pass RLS. Rather than hand
-- the deployment a service_role key that owns the database, two SECURITY
-- DEFINER functions are the only elevated surface and both check a shared
-- secret. These assertions hold that arrangement in place.

reset role;

-- A known secret for the length of this transaction; the rollback restores the
-- real one.
insert into cron_secrets (name, secret) values ('expiry', 'test-secret-for-assertions')
on conflict (name) do update set secret = excluded.secret;

do $$
begin
  perform * from due_expiry_warnings('the-wrong-secret');
  raise exception 'FAILED: the wrong secret was accepted';
exception when sqlstate 'P0001' then
  -- The refusal and the assertion above both raise P0001, so tell them apart
  -- rather than swallowing our own failure.
  if sqlerrm like 'FAILED:%' then
    raise;
  end if;
  raise notice 'ok  the wrong secret is refused';
end;
$$;

select assert(
  not has_function_privilege('anon', 'expiry_cron_authorized(text)', 'EXECUTE'),
  'the secret check is not reachable on its own');

-- A credential inside the window, on a live application, is due exactly once.
update professional_applications set status = 'APPROVED'
 where id = '3333aaaa-0000-4000-8000-000000000001';

update credentials
   set expiration_date = current_date + 10, expiry_warning_sent_for = null
 where id = '5555aaaa-0000-4000-8000-000000000001';
update auth.users set email_confirmed_at = now()
 where id = 'aaaa0000-0000-4000-8000-000000000001';

select assert(
  exists (
    select 1 from due_expiry_warnings('test-secret-for-assertions')
     where item_id = '5555aaaa-0000-4000-8000-000000000001'
  ),
  'a credential expiring inside the window is due for a warning');

select mark_expiry_warnings_sent(
  'test-secret-for-assertions',
  array['5555aaaa-0000-4000-8000-000000000001']::uuid[],
  '{}'::uuid[]);

select assert(
  not exists (
    select 1 from due_expiry_warnings('test-secret-for-assertions')
     where item_id = '5555aaaa-0000-4000-8000-000000000001'
  ),
  'a warned credential is not warned about again');

-- Renewing moves the expiry, which has to re-arm the warning by itself. This is
-- the property the whole design rests on: the column records *which* date was
-- warned about, not merely that a warning happened.
update credentials set expiration_date = current_date + 20
 where id = '5555aaaa-0000-4000-8000-000000000001';

select assert(
  exists (
    select 1 from due_expiry_warnings('test-secret-for-assertions')
     where item_id = '5555aaaa-0000-4000-8000-000000000001'
  ),
  'renewing a credential re-arms its expiry warning');

-- Something already lapsed is a different question — enforcement — and is not
-- what this job is for.
update credentials
   set expiration_date = current_date - 5, expiry_warning_sent_for = null
 where id = '5555aaaa-0000-4000-8000-000000000001';

select assert(
  not exists (
    select 1 from due_expiry_warnings('test-secret-for-assertions')
     where item_id = '5555aaaa-0000-4000-8000-000000000001'
  ),
  'an already-expired credential is not warned about');

reset role;
rollback;
