-- Onboarding gets shorter; what it stops asking has to keep working.
--
-- Three changes, one theme: the wizard should ask only what credentialing
-- needs, and everything a provider fills in later belongs somewhere else.
--
--   1. Offerings become products, and a product is not always an appointment.
--      A provider may sell an in-person session, a physical or digital item, or
--      a professional service delivered some other way. product_type is the
--      first thing they choose, and duration stops being universal because an
--      e-commerce item does not have one.
--
--   2. The "Where you practice" step is removed. Its address was the only place
--      an individual practitioner's address was ever stored: the Practice step
--      collects one, but the save path only persisted it when the provider was
--      an organisation, so for an individual it was asked for and dropped. The
--      Practice step now writes a primary service_locations row for everyone,
--      which is also what keeps primaryJurisdiction() working — it reads
--      locations first, and that drives the whole credentialing engine.
--
--   3. Two more attestations. Both grant DexaFit something, so both are
--      recorded per provider with a version and a timestamp like the others.

begin;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

alter table service_offerings
  add column product_type text not null default 'IN_PERSON_SERVICE';

alter table service_offerings
  add constraint service_offerings_product_type_check
  check (product_type in ('IN_PERSON_SERVICE', 'ECOMMERCE', 'PROFESSIONAL_SERVICE'));

-- Existing rows are all appointment-style offerings, which is what the default
-- above records. They were created when the only option was a booked session.
comment on column service_offerings.product_type is
  'What kind of thing this is: an in-person session, an item sold online, or a professional service delivered another way. Chosen first, because it decides which of the remaining fields apply.';

-- An e-commerce item has no duration. The existing check allowed NULL already,
-- so this only documents the intent and stops a zero sneaking in.
comment on column service_offerings.duration_minutes is
  'Only meaningful for a session. Null for an e-commerce product.';

commit;
