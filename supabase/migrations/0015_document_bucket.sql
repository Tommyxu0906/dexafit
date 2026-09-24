-- Record which bucket a document's bytes are actually in.
--
-- With two buckets, code that derives the bucket from the document type is
-- guessing, and it guesses wrong for every photo uploaded before the split:
-- those bytes are still in the private bucket, so asking the public bucket for
-- them yields a URL that 404s. Storing the bucket makes the row tell the truth
-- instead, and means a later move is a data change rather than a code change.
--
-- Existing rows are backfilled to the private bucket because that is where all
-- of them are, including the profile photos. Moving those objects needs the
-- Storage HTTP API (the bytes are keyed by bucket in object storage, so
-- changing this column alone would orphan them) — scripts/move-profile-photos.mjs
-- does that and updates this column as it goes.

begin;

alter table professional_documents
  add column bucket text not null default 'professional-documents';

alter table professional_documents
  add constraint professional_documents_bucket_check
  check (bucket in ('professional-documents', 'professional-photos'));

-- Only a profile photo may claim to live in the public bucket. The storage
-- policy already refuses to *store* anything else there; this stops a row
-- claiming otherwise, so the two cannot drift apart.
alter table professional_documents
  add constraint professional_documents_public_bucket_is_photo_only
  check (bucket <> 'professional-photos' or document_type = 'PROFILE_PHOTO');

comment on column professional_documents.bucket is
  'Which storage bucket holds these bytes. professional-photos is public and may only ever contain PROFILE_PHOTO; everything else is private and served by short-lived signed URL.';

commit;
