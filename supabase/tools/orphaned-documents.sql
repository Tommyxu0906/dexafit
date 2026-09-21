-- Orphaned document report. Read-only.
--
--   npm run audit:documents
--
-- Uploading is two steps: the bytes go to Storage, then a row goes into
-- professional_documents, then that row is attached to a credential, a policy
-- or a profile photo. Each step can fail after the one before it succeeded,
-- and each failure leaves a different kind of debris.
--
-- Three categories, in descending order of how safe they are to remove.
--
--   1. STORAGE WITHOUT ROW   bytes in the bucket that no row points at. The
--                            row insert failed after the upload succeeded.
--                            Nothing can ever reach these. Safe to delete once
--                            they are old enough that no request is still in
--                            flight.
--
--   2. ROW WITHOUT STORAGE   a row pointing at an object that is not there.
--                            The review page lists the document and the
--                            download fails. Do not delete blind: it may be a
--                            real record whose bytes were lost, which someone
--                            needs to know about. (Demo seed rows land here by
--                            design and are labelled.)
--
--   3. ROW UNATTACHED        a row nothing references — no credential, no
--                            insurance certificate, no profile photo. THIS IS
--                            NOT NECESSARILY GARBAGE. A provider part-way
--                            through the wizard has uploaded a file and not
--                            yet saved the form around it. Never delete these
--                            on age alone.
--
-- The age threshold below is what keeps an upload that is still in progress
-- from being called an orphan.

\set orphan_age '24 hours'

\echo ''
\echo '=== 1. Storage objects with no document row (deletable) ==='
select
  o.name as storage_key,
  pg_size_pretty(coalesce((o.metadata ->> 'size')::bigint, 0)) as size,
  date_trunc('second', now() - o.created_at) as age
from storage.objects o
left join professional_documents d on d.storage_key = o.name
where o.bucket_id = 'professional-documents'
  and d.id is null
  and o.created_at < now() - interval :'orphan_age'
order by o.created_at;

\echo ''
\echo '=== 2. Document rows whose object is missing (investigate) ==='
select
  d.id,
  d.original_filename,
  d.document_type,
  case when p.email like '%@demo.dexafit.invalid'
       then 'demo seed — expected' else 'REAL — bytes lost' end as note,
  date_trunc('second', now() - d.created_at) as age
from professional_documents d
join professional_profiles p on p.id = d.professional_id
left join storage.objects o
       on o.name = d.storage_key and o.bucket_id = 'professional-documents'
where o.name is null
order by note, d.created_at;

\echo ''
\echo '=== 3. Document rows nothing references (do NOT auto-delete) ==='
select
  d.id,
  d.original_filename,
  d.document_type,
  p.display_name,
  a.status as application_status,
  date_trunc('second', now() - d.created_at) as age
from professional_documents d
join professional_profiles p on p.id = d.professional_id
left join professional_applications a on a.professional_id = p.id
where d.created_at < now() - interval :'orphan_age'
  and not exists (select 1 from credentials c where c.document_id = d.id)
  and not exists (select 1 from insurance_policies i where i.certificate_document_id = d.id)
  and not exists (select 1 from compliance_disclosures x where x.supporting_document_id = d.id)
  and not exists (select 1 from professional_profiles f where f.profile_photo_document_id = d.id)
order by d.created_at;

\echo ''
\echo 'Nothing above has been deleted. Category 1 can be cleaned with:'
\echo '  npm run audit:documents -- -v delete_orphans=yes'
\echo ''

-- ---------------------------------------------------------------------------
-- Optional cleanup, category 1 only
-- ---------------------------------------------------------------------------

\if :{?delete_orphans}
\echo 'Deleting category 1 (storage objects with no document row)...'

delete from storage.objects o
where o.bucket_id = 'professional-documents'
  and o.created_at < now() - interval :'orphan_age'
  and not exists (
    select 1 from professional_documents d where d.storage_key = o.name
  );

\echo 'Done. Categories 2 and 3 are never touched by this script.'
\endif
