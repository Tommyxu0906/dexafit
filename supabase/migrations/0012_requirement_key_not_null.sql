-- requirement_key is how a credential says which requirement it satisfies, and
-- it is the whole mechanism that stops one document counting twice.
--
-- Migration 0009 added the column and backfilled it, but left it nullable. That
-- left the readiness engine with an unanswerable question for a keyless row —
-- count it for every requirement of its type, or none? — and it answered by
-- ignoring the column entirely and matching on credential_type, which is the
-- bug this pairs with fixing.
--
-- A physical therapist who is also a dietitian holds two state licences, and
-- one does not satisfy the other. Matching on type alone let a single PT
-- licence clear the dietitian requirement.
--
-- Every row already carries a key and every write path sets one (the save
-- action's schema requires it, and the demo seed supplies it), so the
-- constraint records a fact rather than imposing a new rule. With it in place
-- the engine can match on the key and nothing else.

begin;

-- Fail loudly rather than silently skipping, if this ever runs somewhere the
-- backfill did not reach.
do $$
declare keyless int;
begin
  select count(*) into keyless
    from credentials where requirement_key is null or requirement_key = '';
  if keyless > 0 then
    raise exception 'FAILED: % credential row(s) have no requirement_key; backfill before applying', keyless;
  end if;
end $$;

alter table credentials
  alter column requirement_key set not null;

alter table credentials
  add constraint credentials_requirement_key_not_blank
  check (length(btrim(requirement_key)) > 0);

comment on column credentials.requirement_key is
  'Which requirement this credential satisfies, as produced by requirementKey() in src/lib/domain/requirements.ts. Profession-scoped (PHYSICAL_THERAPIST:STATE_LICENSE) except for credentials a person holds once (CPR_AED, NPI). Readiness matches on this and never on credential_type alone.';

commit;
