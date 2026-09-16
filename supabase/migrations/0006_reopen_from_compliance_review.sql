-- Widen the provider audit policy by one state.
--
-- 0005 allowed a provider's own events to land on SUBMITTED or CREDENTIAL_REVIEW.
-- But reopening an application that is sitting in COMPLIANCE_REVIEW records
-- to_status = COMPLIANCE_REVIEW, which matched neither policy — so that edit
-- would have vanished from the audit trail exactly like the submission did.
--
-- The rule being expressed is "a provider may record a move between review
-- states, never an outcome", so the allowed set is every non-terminal review
-- state. APPROVED, REJECTED, SUSPENDED and EXPIRED remain reviewer-only.

drop policy application_review_events_provider_insert on application_review_events;

create policy application_review_events_provider_insert on application_review_events
  for insert with check (
    not is_admin()
    and event_type in ('SUBMITTED', 'REOPENED_FOR_REVIEW')
    and actor_id is null
    and (
      to_status is null
      or to_status in ('SUBMITTED', 'CREDENTIAL_REVIEW', 'COMPLIANCE_REVIEW')
    )
    and exists (
      select 1 from professional_applications a
      where a.id = application_id and owns_professional(a.professional_id)
    )
  );
