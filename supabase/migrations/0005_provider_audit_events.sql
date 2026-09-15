-- Let a provider record the events they legitimately cause.
--
-- 0004 closed a forgery hole by restricting audit inserts to admins, with one
-- exception for the reopen event. That was too narrow: a provider also causes
-- their own submission, so the SUBMITTED entry was rejected — and because the
-- insert result was not inspected, it failed silently and the audit trail lost
-- the single most important moment in the application's life.
--
-- The forgery protection is unchanged: a provider still cannot claim an
-- approval, name an actor, or touch another professional's application.

drop policy application_review_events_reopen_insert on application_review_events;

create policy application_review_events_provider_insert on application_review_events
  for insert with check (
    not is_admin()
    -- Only the events a provider's own actions produce.
    and event_type in ('SUBMITTED', 'REOPENED_FOR_REVIEW')
    -- Reviewer decisions are never self-attributed, and a provider can never
    -- record themselves arriving at an approved state. `from_status` is left
    -- free: reopening an approved application legitimately starts at APPROVED.
    and actor_id is null
    and (to_status is null or to_status in ('SUBMITTED', 'CREDENTIAL_REVIEW'))
    and exists (
      select 1 from professional_applications a
      where a.id = application_id and owns_professional(a.professional_id)
    )
  );
