-- Profile photos get their own public bucket. Credentials never leave the
-- private one.
--
-- The marketplace will display provider photos, and the obvious way to serve
-- them is to make the bucket public. Today that bucket also holds every
-- licence, certificate and insurance policy — three photos sitting beside
-- fourteen credential documents. Flipping `public` on it would publish all of
-- them at permanent, unauthenticated URLs, with no error and no visible
-- symptom. That is not a hypothetical: it is the single most natural step for
-- whoever builds the public profile page next.
--
-- So the split happens now, before there is a display page to tempt anyone.
--
-- The app routes uploads by document type, but app code is not what makes this
-- safe. The INSERT policy below refuses to store anything except a
-- PROFILE_PHOTO in the public bucket, so a regression in the routing produces a
-- failed upload rather than a published licence. The guard is in the database
-- because that is the only layer an application bug cannot bypass.
--
-- Prevention rather than cleanup, deliberately: public objects are served
-- through a CDN and stay cached after deletion. Measured on this project — a
-- probe file deleted from the bucket still answered 200 with
-- `cf-cache-status: HIT`, and only a cache-busting query string revealed the
-- real 400. So anything wrongly published here cannot be reliably unpublished
-- by deleting it. The only reliable control is never letting it in.

begin;

-- ---------------------------------------------------------------------------
-- The bucket
-- ---------------------------------------------------------------------------
--
-- Images only. A PDF is never a profile photo, and a public bucket that accepts
-- PDFs is a document-publishing surface waiting for a mistake.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'professional-photos',
  'professional-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- Anyone may read. That is the entire point of the bucket, and it is safe only
-- because of the insert guard below.
create policy professional_photos_storage_select
  on storage.objects for select
  using (bucket_id = 'professional-photos');

-- The guard. Two conditions, both required:
--
--   1. the first path segment is a professional the caller owns, which is the
--      same ownership rule the private bucket uses;
--   2. the second path segment is exactly PROFILE_PHOTO.
--
-- (2) is what keeps a credential out of a public bucket even if the application
-- asks for one to be put there.
create policy professional_photos_storage_insert
  on storage.objects for insert
  with check (
    bucket_id = 'professional-photos'
    and owns_professional(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = 'PROFILE_PHOTO'
  );

create policy professional_photos_storage_update
  on storage.objects for update
  using (
    bucket_id = 'professional-photos'
    and owns_professional(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'professional-photos'
    and owns_professional(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = 'PROFILE_PHOTO'
  );

create policy professional_photos_storage_delete
  on storage.objects for delete
  using (
    bucket_id = 'professional-photos'
    and owns_professional(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Keep the private bucket private
-- ---------------------------------------------------------------------------
--
-- Belt and braces: if someone later flips this flag in the dashboard, this
-- records that it was deliberate here and the security suite asserts it.
update storage.buckets set public = false where id = 'professional-documents';

commit;
