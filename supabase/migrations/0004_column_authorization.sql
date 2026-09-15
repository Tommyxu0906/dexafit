-- Column-level authorization.
--
-- RLS answers "which rows?" but not "which columns?". The policies in 0002 let a
-- professional write any column of a row they own, which meant a provider could
-- set their own credential to VERIFIED, their own application to APPROVED, and
-- their own marketplace_status to ACTIVE — appearing as a DexaFit-verified
-- professional without any review.
--
-- These triggers enforce one rule: a professional may move themselves DOWN the
-- privilege ladder but never up. Reviewer-owned columns are pinned to their
-- previous values for non-admins, so the guarantee holds no matter which client
-- performs the write — server action, PostgREST, or direct SQL.
--
-- Escalation is neutralized rather than raised as an error, so that legitimate
-- de-escalating writes in the same statement still apply.

-- Writes with no authenticated user come from a trusted server context: a
-- migration, the SQL editor, or the service_role key. Those must stay able to
-- bootstrap the first admin. This is not a hole: every RLS policy on these
-- tables keys off auth.uid(), so an anonymous caller matches no rows to begin
-- with and never reaches these triggers.
create function acting_with_admin_rights()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is null or is_admin();
$$;

-- ---------------------------------------------------------------------------
-- credentials
-- ---------------------------------------------------------------------------

create function guard_credential_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  substantive_change boolean;
begin
  if acting_with_admin_rights() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A provider never files a pre-verified credential.
    new.verification_status := 'UNVERIFIED';
    new.verification_source_url := null;
    new.verified_at := null;
    new.verified_by := null;
    new.admin_notes := null;
    return new;
  end if;

  -- Reviewer-owned columns are not the provider's to write.
  new.verification_source_url := old.verification_source_url;
  new.admin_notes := old.admin_notes;

  substantive_change :=
    new.credential_type      is distinct from old.credential_type
    or new.credential_name   is distinct from old.credential_name
    or new.credential_number is distinct from old.credential_number
    or new.issuing_authority is distinct from old.issuing_authority
    or new.jurisdiction_country is distinct from old.jurisdiction_country
    or new.jurisdiction_state   is distinct from old.jurisdiction_state
    or new.issue_date        is distinct from old.issue_date
    or new.expiration_date   is distinct from old.expiration_date
    or new.document_id       is distinct from old.document_id;

  if substantive_change and old.verification_status = 'VERIFIED' then
    -- Editing a verified credential drops it back to review; a swapped license
    -- number must never inherit the old approval.
    new.verification_status := 'PENDING';
    new.verified_at := null;
    new.verified_by := null;
  else
    new.verification_status := old.verification_status;
    new.verified_at := old.verified_at;
    new.verified_by := old.verified_by;
  end if;

  return new;
end;
$$;

create trigger guard_credential_columns
  before insert or update on credentials
  for each row execute function guard_credential_columns();

-- ---------------------------------------------------------------------------
-- insurance_policies
-- ---------------------------------------------------------------------------

create function guard_insurance_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  substantive_change boolean;
begin
  if acting_with_admin_rights() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'SUBMITTED';
    new.verified_at := null;
    new.verified_by := null;
    new.admin_notes := null;
    return new;
  end if;

  new.admin_notes := old.admin_notes;

  substantive_change :=
    new.insurance_type   is distinct from old.insurance_type
    or new.carrier_name  is distinct from old.carrier_name
    or new.policy_number is distinct from old.policy_number
    or new.coverage_per_claim is distinct from old.coverage_per_claim
    or new.coverage_aggregate is distinct from old.coverage_aggregate
    or new.effective_date  is distinct from old.effective_date
    or new.expiration_date is distinct from old.expiration_date
    or new.certificate_document_id is distinct from old.certificate_document_id;

  if substantive_change and old.status = 'VERIFIED' then
    new.status := 'SUBMITTED';
    new.verified_at := null;
    new.verified_by := null;
  else
    new.status := old.status;
    new.verified_at := old.verified_at;
    new.verified_by := old.verified_by;
  end if;

  return new;
end;
$$;

create trigger guard_insurance_columns
  before insert or update on insurance_policies
  for each row execute function guard_insurance_columns();

-- ---------------------------------------------------------------------------
-- compliance_disclosures
-- ---------------------------------------------------------------------------

create function guard_disclosure_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if acting_with_admin_rights() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.resolved_by_admin := false;
    new.resolved_at := null;
    new.resolved_by := null;
    new.admin_notes := null;
    return new;
  end if;

  -- Only a reviewer clears a disclosure. Re-answering yes re-opens it.
  new.admin_notes := old.admin_notes;
  new.resolved_by := old.resolved_by;

  if new.answer is distinct from old.answer or new.explanation is distinct from old.explanation then
    new.resolved_by_admin := false;
    new.resolved_at := null;
    new.resolved_by := null;
  else
    new.resolved_by_admin := old.resolved_by_admin;
    new.resolved_at := old.resolved_at;
  end if;

  return new;
end;
$$;

create trigger guard_disclosure_columns
  before insert or update on compliance_disclosures
  for each row execute function guard_disclosure_columns();

-- ---------------------------------------------------------------------------
-- professional_profiles
-- ---------------------------------------------------------------------------

create function guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if acting_with_admin_rights() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.marketplace_status := 'INACTIVE';
    return new;
  end if;

  -- Going ACTIVE is a reviewer decision. Standing down is always allowed, so an
  -- edit that invalidates a listing can pull it immediately.
  if new.marketplace_status = 'ACTIVE' and old.marketplace_status <> 'ACTIVE' then
    new.marketplace_status := old.marketplace_status;
  end if;

  return new;
end;
$$;

create trigger guard_profile_columns
  before insert or update on professional_profiles
  for each row execute function guard_profile_columns();

-- ---------------------------------------------------------------------------
-- professional_applications
-- ---------------------------------------------------------------------------

create function guard_application_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if acting_with_admin_rights() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'DRAFT';
    new.submitted_at := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.admin_notes := null;
    new.independent_listing_eligible := null;
    return new;
  end if;

  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  new.admin_notes := old.admin_notes;
  new.independent_listing_eligible := old.independent_listing_eligible;

  -- Manual review may be switched on by the applicant's own answers, never off.
  if old.manual_review_required then
    new.manual_review_required := true;
  end if;

  -- The only transitions a provider may drive: finish a draft, or send an
  -- already-submitted application back for re-review after an edit.
  if new.status is distinct from old.status then
    if not (
      (old.status = 'DRAFT' and new.status = 'SUBMITTED')
      or (old.status in ('SUBMITTED', 'CREDENTIAL_REVIEW', 'COMPLIANCE_REVIEW',
                         'NEEDS_INFORMATION', 'APPROVED')
          and new.status = 'CREDENTIAL_REVIEW')
    ) then
      new.status := old.status;
    end if;
  end if;

  -- submitted_at is stamped once, on the provider's own submission.
  if old.submitted_at is not null then
    new.submitted_at := old.submitted_at;
  elsif new.status <> 'SUBMITTED' then
    new.submitted_at := null;
  end if;

  return new;
end;
$$;

create trigger guard_application_columns
  before insert or update on professional_applications
  for each row execute function guard_application_columns();

-- ---------------------------------------------------------------------------
-- app_users — belt and braces over the existing RLS check
-- ---------------------------------------------------------------------------

create function guard_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if acting_with_admin_rights() then
    return new;
  end if;
  new.role := coalesce(old.role, 'PROFESSIONAL');
  return new;
end;
$$;

create trigger guard_user_role
  before update on app_users
  for each row execute function guard_user_role();

-- ---------------------------------------------------------------------------
-- application_review_events — the audit trail must not be forgeable
-- ---------------------------------------------------------------------------
-- 0002 allowed any insert where actor_id = auth.uid(), so a provider could write
-- an "APPROVED" entry into their own history. It also rejected the legitimate
-- provider-triggered reopen event, which passes actor_id = null.

drop policy application_review_events_insert on application_review_events;

create policy application_review_events_admin_insert on application_review_events
  for insert with check (is_admin());

create policy application_review_events_reopen_insert on application_review_events
  for insert with check (
    not is_admin()
    and event_type = 'REOPENED_FOR_REVIEW'
    and actor_id is null
    and exists (
      select 1 from professional_applications a
      where a.id = application_id and owns_professional(a.professional_id)
    )
  );

-- The audit trail is append-only for everyone; history is not editable.
create function reject_review_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'application_review_events is append-only';
end;
$$;

create trigger reject_review_event_mutation
  before update or delete on application_review_events
  for each row execute function reject_review_event_mutation();
