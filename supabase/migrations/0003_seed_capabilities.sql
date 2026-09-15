-- Capability reference data.
--
-- These codes are the provider half of the future matching model:
--   customer scan -> needs vector -> professional capability vector -> score.
-- Scoring is out of scope for v1; only the vocabulary is established here.

insert into capabilities (code, label, category, sort_order) values
  ('GENERAL_WELLNESS',     'General wellness',      'CLIENT_POPULATION', 10),
  ('BODY_RECOMPOSITION',   'Body recomposition',    'CLIENT_POPULATION', 20),
  ('WEIGHT_MANAGEMENT',    'Weight management',     'CLIENT_POPULATION', 30),
  ('MUSCLE_GAIN',          'Muscle gain',           'CLIENT_POPULATION', 40),
  ('ATHLETES',             'Athletes',              'CLIENT_POPULATION', 50),
  ('OLDER_ADULTS',         'Older adults',          'CLIENT_POPULATION', 60),
  ('WOMENS_HEALTH',        'Women''s health',       'CLIENT_POPULATION', 70),
  ('MENS_HEALTH',          'Men''s health',         'CLIENT_POPULATION', 80),
  ('POST_INJURY',          'Post-injury',           'CLIENT_POPULATION', 90),
  ('BONE_HEALTH',          'Bone health',           'CLIENT_POPULATION', 100),
  ('METABOLIC_HEALTH',     'Metabolic health',      'CLIENT_POPULATION', 110),
  ('PERFORMANCE',          'Performance',           'CLIENT_POPULATION', 120),
  ('BEGINNERS',            'Beginners',             'CLIENT_POPULATION', 130)
on conflict (code) do nothing;

insert into capabilities (code, label, category, sort_order) values
  ('HIGH_BODY_FAT',                  'High body fat',                   'DEXA_CAPABILITY', 10),
  ('LOW_LEAN_MASS',                  'Low lean mass',                   'DEXA_CAPABILITY', 20),
  ('LOW_ALMI',                       'Low ALMI',                        'DEXA_CAPABILITY', 30),
  ('LOW_FFMI',                       'Low FFMI',                        'DEXA_CAPABILITY', 40),
  ('ELEVATED_VISCERAL_FAT',          'Elevated visceral fat',           'DEXA_CAPABILITY', 50),
  ('ELEVATED_ANDROID_GYNOID_RATIO',  'Elevated android/gynoid ratio',   'DEXA_CAPABILITY', 60),
  ('LEAN_MASS_ASYMMETRY',            'Lean mass asymmetry',             'DEXA_CAPABILITY', 70),
  ('MOBILITY_LIMITATION',            'Mobility limitation',             'DEXA_CAPABILITY', 80),
  ('POST_REHAB_STRENGTH',            'Post-rehab strength',             'DEXA_CAPABILITY', 90),
  ('DEXA_BONE_HEALTH',               'Bone health',                     'DEXA_CAPABILITY', 100),
  ('LOW_BMD_INDICATOR',              'Low BMD indicator',               'DEXA_CAPABILITY', 110),
  ('DEXA_BODY_RECOMPOSITION',        'Body recomposition',              'DEXA_CAPABILITY', 120),
  ('DEXA_MUSCLE_GAIN',               'Muscle gain',                     'DEXA_CAPABILITY', 130),
  ('FAT_LOSS',                       'Fat loss',                        'DEXA_CAPABILITY', 140),
  ('SPORTS_PERFORMANCE',             'Sports performance',              'DEXA_CAPABILITY', 150),
  ('GENERAL_LONGEVITY',              'General longevity',               'DEXA_CAPABILITY', 160)
on conflict (code) do nothing;

-- Clinical scopes. No unlicensed profession may ever be offered these; they
-- exist so licensed professionals can be matched against them later.
insert into capabilities (code, label, category, sort_order) values
  ('MEDICAL_NUTRITION_THERAPY',      'Medical nutrition therapy',       'DEXA_CAPABILITY', 200),
  ('DIAGNOSE_METABOLIC_DISEASE',     'Diagnose metabolic disease',      'DEXA_CAPABILITY', 210),
  ('PHYSICAL_THERAPY',               'Physical therapy',                'DEXA_CAPABILITY', 220),
  ('INJURY_DIAGNOSIS',               'Injury diagnosis',                'DEXA_CAPABILITY', 230),
  ('PSYCHOTHERAPY',                  'Psychotherapy',                   'DEXA_CAPABILITY', 240),
  ('MEDICAL_DIAGNOSIS',              'Medical diagnosis',               'DEXA_CAPABILITY', 250)
on conflict (code) do nothing;
