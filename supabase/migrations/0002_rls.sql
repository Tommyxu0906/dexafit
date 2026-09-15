-- Row level security.
--
-- Two principals: the professional (owns exactly their own graph) and the
-- DexaFit admin (read-all, plus review-state writes). Ownership is never taken
-- from client-submitted ids; every policy derives it from auth.uid().

alter table app_users enable row level security;
alter table organizations enable row level security;
alter table professional_profiles enable row level security;
alter table professional_organization_memberships enable row level security;
alter table professional_applications enable row level security;
alter table professional_documents enable row level security;
alter table credentials enable row level security;
alter table insurance_policies enable row level security;
alter table compliance_disclosures enable row level security;
alter table capabilities enable row level security;
alter table professional_capabilities enable row level security;
alter table service_offerings enable row level security;
alter table service_locations enable row level security;
alter table professional_service_jurisdictions enable row level security;
alter table attestations enable row level security;
alter table application_review_events enable row level security;

-- Does the current user own this professional row?
create function owns_professional(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from professional_profiles
    where id = p_professional_id and user_id = auth.uid()
  );
$$;

-- app_users ------------------------------------------------------------------

create policy app_users_select_self on app_users
  for select using (id = auth.uid() or is_admin());

create policy app_users_update_self on app_users
  for update using (id = auth.uid()) with check (id = auth.uid() and role = 'PROFESSIONAL');

-- organizations --------------------------------------------------------------

create policy organizations_select on organizations
  for select using (
    is_admin()
    or exists (
      select 1 from professional_profiles p
      where p.organization_id = organizations.id and p.user_id = auth.uid()
    )
  );

create policy organizations_insert on organizations
  for insert with check (auth.uid() is not null);

create policy organizations_update on organizations
  for update using (
    is_admin()
    or exists (
      select 1 from professional_profiles p
      where p.organization_id = organizations.id and p.user_id = auth.uid()
    )
  );

-- professional_profiles ------------------------------------------------------

create policy professional_profiles_select on professional_profiles
  for select using (user_id = auth.uid() or is_admin());

create policy professional_profiles_insert on professional_profiles
  for insert with check (user_id = auth.uid());

create policy professional_profiles_update on professional_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy professional_profiles_admin_update on professional_profiles
  for update using (is_admin()) with check (is_admin());

-- Child tables owned through professional_id ---------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'professional_organization_memberships',
    'professional_documents',
    'credentials',
    'insurance_policies',
    'compliance_disclosures',
    'professional_capabilities',
    'service_offerings',
    'service_locations',
    'professional_service_jurisdictions',
    'attestations'
  ]
  loop
    execute format(
      'create policy %I_select on %I for select
       using (owns_professional(professional_id) or is_admin())', t, t
    );
    execute format(
      'create policy %I_insert on %I for insert
       with check (owns_professional(professional_id))', t, t
    );
    execute format(
      'create policy %I_update on %I for update
       using (owns_professional(professional_id))
       with check (owns_professional(professional_id))', t, t
    );
    execute format(
      'create policy %I_delete on %I for delete
       using (owns_professional(professional_id))', t, t
    );
    execute format(
      'create policy %I_admin_update on %I for update
       using (is_admin()) with check (is_admin())', t, t
    );
  end loop;
end;
$$;

-- professional_applications --------------------------------------------------

create policy professional_applications_select on professional_applications
  for select using (owns_professional(professional_id) or is_admin());

create policy professional_applications_insert on professional_applications
  for insert with check (owns_professional(professional_id));

create policy professional_applications_update on professional_applications
  for update using (owns_professional(professional_id))
  with check (owns_professional(professional_id));

create policy professional_applications_admin_update on professional_applications
  for update using (is_admin()) with check (is_admin());

-- capabilities (reference data, readable by any signed-in user) ---------------

create policy capabilities_select on capabilities
  for select using (auth.uid() is not null);

-- application_review_events --------------------------------------------------
-- Providers may read their own history; only admins write it.

create policy application_review_events_select on application_review_events
  for select using (
    is_admin()
    or exists (
      select 1 from professional_applications a
      where a.id = application_review_events.application_id
        and owns_professional(a.professional_id)
    )
  );

create policy application_review_events_insert on application_review_events
  for insert with check (is_admin() or actor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Private document storage
-- ---------------------------------------------------------------------------
-- Credential and insurance documents live in a private bucket. There is no
-- public read policy: files are only reachable through short-lived signed URLs
-- minted server-side after an ownership/admin check.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'professional-documents',
  'professional-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Objects are keyed as <professional_id>/<document_type>/<uuid>.<ext>, so the
-- first path segment carries ownership.
create policy professional_documents_storage_select on storage.objects
  for select using (
    bucket_id = 'professional-documents'
    and (
      is_admin()
      or owns_professional(((storage.foldername(name))[1])::uuid)
    )
  );

create policy professional_documents_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'professional-documents'
    and owns_professional(((storage.foldername(name))[1])::uuid)
  );

create policy professional_documents_storage_delete on storage.objects
  for delete using (
    bucket_id = 'professional-documents'
    and owns_professional(((storage.foldername(name))[1])::uuid)
  );
