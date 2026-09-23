-- A supervising/directing clinician relationship is a credentialing artefact.
--
-- Two Massachusetts professions cannot lawfully practise on their own, and in
-- both cases the relationship is something the provider must be able to
-- evidence on paper:
--
--   Athletic trainer   259 CMR 4.02(3): "An athletic trainer must establish an
--                      agreed upon relationship with a Physician or Dentist
--                      that provides Direction for the Athletic Trainer's
--                      actions and responsibilities and must be able to provide
--                      written proof thereof upon request."
--
--   Physician assistant 263 CMR 5.00: all professional activities are supervised
--                      by a supervising physician, under written guidelines
--                      signed by both and reviewed annually.
--
-- Modelled as a credential rather than a plain document because it needs
-- exactly what the credentials table already provides: an attached file, a
-- verification status a reviewer can set, an expiration (the PA guidelines are
-- reviewed annually), and the ability to block approval while it is missing.
-- `issuing_authority` carries the supervising clinician or practice.
--
-- This migration only widens what the column accepts. No row is rewritten, and
-- no existing credential changes meaning.

begin;

alter table credentials
  drop constraint credentials_credential_type_check;

alter table credentials
  add constraint credentials_credential_type_check
  check (credential_type = any (array[
    'STATE_LICENSE',
    'NATIONAL_CERTIFICATION',
    'BOARD_CERTIFICATION',
    'CPR_AED',
    'RN_LICENSE',
    'APRN_AUTHORIZATION',
    'HSP_CERTIFICATION',
    'SUPERVISION_AGREEMENT',
    'NPI',
    'OTHER'
  ]));

comment on column credentials.credential_type is
  'What kind of credential this row is. SUPERVISION_AGREEMENT is the written directing/supervising clinician relationship that Massachusetts requires of athletic trainers (259 CMR 4.02(3)) and physician assistants (263 CMR 5.00).';

commit;
