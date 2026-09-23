-- A professional may practise more than one profession.
--
-- Someone can hold a physical therapy licence and a dietitian licence, or be a
-- personal trainer who is also a certified nutrition coach. A single
-- profession_type forced them to pick one and hid the credentials the other one
-- legally requires.
--
-- Three things change together:
--
--   1. professional_profiles.profession_type  ->  profession_types text[]
--   2. credentials gain requirement_key, so a credential records *which*
--      requirement it satisfies. Two professions can both demand a
--      STATE_LICENSE and one licence must not satisfy both.
--   3. professional_service_jurisdictions becomes one row per profession per
--      state, because it is a licence that authorises practice in a state and
--      each profession has its own.
--
-- The profession list is also narrowed to what a DEXA scan can actually route
-- to. Mental-health professions are removed: no DEXA output — lean mass, body
-- fat, visceral fat, bone density, asymmetry — refers a customer to a
-- therapist. Sports performance coach is merged into strength & conditioning,
-- and exercise physiologist is added.

begin;

-- ---------------------------------------------------------------------------
-- Refuse to mangle a real record
-- ---------------------------------------------------------------------------

-- Demo fixtures are disposable and are reseeded from supabase/seed/demo.sql.
-- A real provider holding a removed profession is not, and must be a decision
-- rather than something a migration does quietly at 3am.
do $$
declare
  affected int;
begin
  select count(*) into affected
  from professional_profiles p
  join app_users u on u.id = p.user_id
  where p.profession_type in
        ('LMHC','LSMHC','LMFT','LICSW','LCSW','PSYCHOLOGIST')
    and u.email not like '%@demo.dexafit.invalid';

  if affected > 0 then
    raise exception
      'Refusing to migrate: % real profile(s) hold a profession being removed. Decide what happens to them first.',
      affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- professional_profiles.profession_types
-- ---------------------------------------------------------------------------

alter table professional_profiles
  add column profession_types text[] not null default '{}';

-- Carry every existing selection across, mapping the merged category.
update professional_profiles
   set profession_types = case
     when profession_type is null then '{}'::text[]
     when profession_type = 'SPORTS_PERFORMANCE_COACH'
       then array['STRENGTH_CONDITIONING_COACH']
     when profession_type in ('LMHC','LSMHC','LMFT','LICSW','LCSW','PSYCHOLOGIST')
       then '{}'::text[]
     else array[profession_type]
   end;

alter table professional_profiles
  add constraint professional_profiles_profession_types_valid
  check (
    profession_types <@ array[
      'PERSONAL_TRAINER',
      'STRENGTH_CONDITIONING_COACH',
      'EXERCISE_PHYSIOLOGIST',
      'HEALTH_WELLNESS_COACH',
      'NUTRITION_COACH',
      'DIETITIAN_NUTRITIONIST',
      'PHYSICAL_THERAPIST',
      'ATHLETIC_TRAINER',
      'PHYSICIAN',
      'NURSE_PRACTITIONER',
      'PHYSICIAN_ASSISTANT',
      'OTHER'
    ]::text[]
  );

drop index if exists professional_profiles_profession_type_idx;
alter table professional_profiles drop column profession_type;

-- Lets "which providers are physical therapists" stay an index scan once the
-- public marketplace starts querying it.
create index professional_profiles_profession_types_idx
  on professional_profiles using gin (profession_types);

-- ---------------------------------------------------------------------------
-- credentials.requirement_key
-- ---------------------------------------------------------------------------

alter table credentials add column requirement_key text;

comment on column credentials.requirement_key is
  'Which requirement this credential satisfies, as PROFESSION:CREDENTIAL_TYPE, or the bare type for credentials held once (CPR_AED, NPI). Matching on credential_type alone let one licence satisfy two professions requirements.';

-- Backfill from the profession the holder had at the time. Shared credentials
-- key on their type; everything else is scoped to the single profession that
-- existed before this migration.
update credentials c
   set requirement_key = case
     when c.credential_type in ('CPR_AED','NPI') then c.credential_type
     when p.profession_types = '{}'::text[] then c.credential_type
     else p.profession_types[1] || ':' || c.credential_type
   end
  from professional_profiles p
 where p.id = c.professional_id;

create index credentials_requirement_key_idx
  on credentials (professional_id, requirement_key);

-- ---------------------------------------------------------------------------
-- One jurisdiction row per profession
-- ---------------------------------------------------------------------------

-- Looked up rather than named: Postgres truncates generated constraint names to
-- 63 characters, so the literal name is not something to guess at.
do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
    from pg_constraint
   where conrelid = 'professional_service_jurisdictions'::regclass
     and contype = 'u'
     and array_length(conkey, 1) = 3;

  if constraint_name is not null then
    execute format(
      'alter table professional_service_jurisdictions drop constraint %I',
      constraint_name
    );
  end if;
end $$;

update professional_service_jurisdictions
   set profession_type = 'STRENGTH_CONDITIONING_COACH'
 where profession_type = 'SPORTS_PERFORMANCE_COACH';

delete from professional_service_jurisdictions
 where profession_type in ('LMHC','LSMHC','LMFT','LICSW','LCSW','PSYCHOLOGIST');

alter table professional_service_jurisdictions
  add constraint professional_service_jurisdictions_unique
  unique (professional_id, country, state, profession_type);

-- ---------------------------------------------------------------------------
-- Capabilities no profession can claim any more
-- ---------------------------------------------------------------------------

-- Psychotherapy was only ever selectable by the mental-health professions.
-- Leaving it would offer reviewers a capability nobody can hold.
delete from professional_capabilities where capability_code = 'PSYCHOTHERAPY';
delete from capabilities where code = 'PSYCHOTHERAPY';

commit;
