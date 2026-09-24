-- Split "who you work with" from "what you can act on", and stop pretending
-- DexaFit only runs DEXA scans.
--
-- Two problems with the old capability list:
--
--   1. The axes overlapped. BODY_RECOMPOSITION and MUSCLE_GAIN were client
--      populations AND, under a DEXA_ prefix invented purely to dodge the key
--      collision, DEXA capabilities. The form asked the same question twice.
--      FAT_LOSS, SPORTS_PERFORMANCE and GENERAL_LONGEVITY were goals filed as
--      findings. Goals now live only on the population axis.
--
--   2. DexaFit runs three tests, not one: DEXA (body composition, visceral
--      fat, bone density), VO2 max (cardiorespiratory fitness, heart-rate
--      zones) and RMR (metabolic rate, fuel utilisation), plus biological age
--      across them. Only the DEXA outputs were modelled, so a provider could
--      not say they read a VO2 max or set targets from a measured RMR.
--
-- professional_capabilities.capability_code cascades on delete, so a provider's
-- selections are migrated to their replacements BEFORE any row is removed.
-- Deleting first would silently throw away what providers had chosen.

begin;

-- ---------------------------------------------------------------------------
-- 1. Move existing selections onto their replacements
-- ---------------------------------------------------------------------------

-- The bone-health duplicate: one code was the population, the other the
-- finding, with the same label on screen.
update professional_capabilities
   set capability_code = 'LOW_BMD_INDICATOR'
 where capability_code = 'DEXA_BONE_HEALTH'
   and not exists (
     select 1 from professional_capabilities other
      where other.professional_id = professional_capabilities.professional_id
        and other.capability_code = 'LOW_BMD_INDICATOR'
   );

-- Post-rehab strength is a population, not something a scan reports.
update professional_capabilities
   set capability_code = 'POST_INJURY'
 where capability_code = 'POST_REHAB_STRENGTH'
   and not exists (
     select 1 from professional_capabilities other
      where other.professional_id = professional_capabilities.professional_id
        and other.capability_code = 'POST_INJURY'
   );

-- Goals that were filed as findings map onto the population that already meant
-- the same thing.
update professional_capabilities
   set capability_code = 'BODY_RECOMPOSITION'
 where capability_code = 'DEXA_BODY_RECOMPOSITION'
   and not exists (
     select 1 from professional_capabilities other
      where other.professional_id = professional_capabilities.professional_id
        and other.capability_code = 'BODY_RECOMPOSITION'
   );

update professional_capabilities
   set capability_code = 'MUSCLE_GAIN'
 where capability_code = 'DEXA_MUSCLE_GAIN'
   and not exists (
     select 1 from professional_capabilities other
      where other.professional_id = professional_capabilities.professional_id
        and other.capability_code = 'MUSCLE_GAIN'
   );

update professional_capabilities
   set capability_code = 'WEIGHT_MANAGEMENT'
 where capability_code = 'FAT_LOSS'
   and not exists (
     select 1 from professional_capabilities other
      where other.professional_id = professional_capabilities.professional_id
        and other.capability_code = 'WEIGHT_MANAGEMENT'
   );

update professional_capabilities
   set capability_code = 'ATHLETES'
 where capability_code in ('SPORTS_PERFORMANCE', 'PERFORMANCE')
   and not exists (
     select 1 from professional_capabilities other
      where other.professional_id = professional_capabilities.professional_id
        and other.capability_code = 'ATHLETES'
   );

update professional_capabilities
   set capability_code = 'LONGEVITY'
 where capability_code = 'GENERAL_LONGEVITY'
   and not exists (
     select 1 from professional_capabilities other
      where other.professional_id = professional_capabilities.professional_id
        and other.capability_code = 'LONGEVITY'
   );

-- ---------------------------------------------------------------------------
-- 2. The new catalogue
-- ---------------------------------------------------------------------------

-- The category is renamed because these findings are no longer all DEXA: VO2
-- max and RMR are separate tests. Widen the constraint first, move the rows,
-- then narrow it back so the old name cannot come back.
alter table capabilities drop constraint capabilities_category_check;
alter table capabilities add constraint capabilities_category_check
  check (category in ('CLIENT_POPULATION', 'DEXA_CAPABILITY', 'ASSESSMENT_FINDING',
                      'CLINICAL_CAPABILITY'));

insert into capabilities (code, label, category, sort_order) values
  ('GLP1_SUPPORT', 'Weight-loss medication (GLP-1) clients', 'CLIENT_POPULATION', 35),
  ('LONGEVITY', 'Longevity & healthy aging', 'CLIENT_POPULATION', 95),
  ('LOW_VO2_MAX', 'Low VO2 max for age and sex', 'ASSESSMENT_FINDING', 300),
  ('HEART_RATE_ZONES', 'Heart-rate zone / Zone 2 programming', 'ASSESSMENT_FINDING', 310),
  ('LOW_RMR', 'Lower-than-predicted metabolic rate', 'ASSESSMENT_FINDING', 400),
  ('RMR_CALORIE_TARGETS', 'Calorie targets from measured RMR', 'ASSESSMENT_FINDING', 410),
  ('SUBSTRATE_UTILIZATION', 'Fuel utilisation (fat vs carbohydrate)', 'ASSESSMENT_FINDING', 420),
  ('ELEVATED_BIOLOGICAL_AGE', 'Biological age older than chronological', 'ASSESSMENT_FINDING', 500)
on conflict (code) do update
  set label = excluded.label,
      category = excluded.category,
      sort_order = excluded.sort_order;

-- Mobility limitation describes a person, not a measurement.
update capabilities set category = 'CLIENT_POPULATION', sort_order = 150
 where code = 'MOBILITY_LIMITATION';

-- Everything still modelled keeps its row; the category name changes because
-- these are no longer all DEXA, and several labels were jargon or duplicates.
update capabilities set category = 'ASSESSMENT_FINDING'
 where category = 'DEXA_CAPABILITY';

-- The clinical scopes were filed under DEXA_CAPABILITY too, which was already
-- wrong and becomes obvious once the category is named honestly: "Medical
-- diagnosis" is not something a scan reports. They are what a licence permits,
-- and they get their own category. The application derives these by exclusion
-- from the TypeScript lists, so this is the reference data catching up with
-- what the code already believed.
update capabilities set category = 'CLINICAL_CAPABILITY'
 where code in ('MEDICAL_NUTRITION_THERAPY', 'DIAGNOSE_METABOLIC_DISEASE',
                'PHYSICAL_THERAPY', 'INJURY_DIAGNOSIS', 'MEDICAL_DIAGNOSIS');

update capabilities set label = 'High body fat percentage' where code = 'HIGH_BODY_FAT';
update capabilities set label = 'Low ALMI (appendicular lean mass index)' where code = 'LOW_ALMI';
update capabilities set label = 'Low FFMI (fat-free mass index)' where code = 'LOW_FFMI';
update capabilities set label = 'Left/right lean mass asymmetry' where code = 'LEAN_MASS_ASYMMETRY';
update capabilities set label = 'Low bone density (low T-score)' where code = 'LOW_BMD_INDICATOR';
update capabilities set label = 'Just getting started' where code = 'BEGINNERS';
update capabilities set label = 'Weight loss' where code = 'WEIGHT_MANAGEMENT';
update capabilities set label = 'Athletes & performance' where code = 'ATHLETES';
update capabilities set label = 'Post-injury & return to activity' where code = 'POST_INJURY';
update capabilities set label = 'Limited mobility' where code = 'MOBILITY_LIMITATION';

-- ---------------------------------------------------------------------------
-- 3. Retire the duplicates and the goals-as-findings
-- ---------------------------------------------------------------------------
--
-- Safe only because step 1 moved every selection off these codes. The delete
-- cascades, so anything still pointing here would be lost silently.

-- A provider who already held the replacement could not be moved onto it: the
-- (professional_id, capability_code) unique constraint forbids the duplicate.
-- One provider on file held both POST_INJURY and POST_REHAB_STRENGTH. Dropping
-- the retired code loses nothing there, because the replacement is already
-- selected. This is deduplication, not data loss, and it must happen before the
-- assertion below or the migration aborts on a case that is actually fine.
delete from professional_capabilities pc
 where pc.capability_code in (
         'DEXA_BONE_HEALTH', 'POST_REHAB_STRENGTH', 'DEXA_BODY_RECOMPOSITION',
         'DEXA_MUSCLE_GAIN', 'FAT_LOSS', 'SPORTS_PERFORMANCE', 'PERFORMANCE',
         'GENERAL_LONGEVITY')
   and exists (
     select 1 from professional_capabilities kept
      where kept.professional_id = pc.professional_id
        and kept.capability_code = case pc.capability_code
              when 'DEXA_BONE_HEALTH' then 'LOW_BMD_INDICATOR'
              when 'POST_REHAB_STRENGTH' then 'POST_INJURY'
              when 'DEXA_BODY_RECOMPOSITION' then 'BODY_RECOMPOSITION'
              when 'DEXA_MUSCLE_GAIN' then 'MUSCLE_GAIN'
              when 'FAT_LOSS' then 'WEIGHT_MANAGEMENT'
              when 'SPORTS_PERFORMANCE' then 'ATHLETES'
              when 'PERFORMANCE' then 'ATHLETES'
              when 'GENERAL_LONGEVITY' then 'LONGEVITY'
            end
   );

do $$
declare stranded int;
begin
  select count(*) into stranded
    from professional_capabilities
   where capability_code in (
     'DEXA_BONE_HEALTH', 'POST_REHAB_STRENGTH', 'DEXA_BODY_RECOMPOSITION',
     'DEXA_MUSCLE_GAIN', 'FAT_LOSS', 'SPORTS_PERFORMANCE', 'PERFORMANCE',
     'GENERAL_LONGEVITY'
   );
  if stranded > 0 then
    raise exception 'FAILED: % selection(s) still on retired codes; the migration above did not move them', stranded;
  end if;
end $$;

delete from capabilities where code in (
  'DEXA_BONE_HEALTH', 'POST_REHAB_STRENGTH', 'DEXA_BODY_RECOMPOSITION',
  'DEXA_MUSCLE_GAIN', 'FAT_LOSS', 'SPORTS_PERFORMANCE', 'PERFORMANCE',
  'GENERAL_LONGEVITY'
);

-- No row should still carry the old category name.
alter table capabilities drop constraint capabilities_category_check;
alter table capabilities add constraint capabilities_category_check
  check (category in ('CLIENT_POPULATION', 'ASSESSMENT_FINDING', 'CLINICAL_CAPABILITY'));

commit;
