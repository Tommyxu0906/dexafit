-- Resolving the address a status email may be sent to.
--
-- professional_profiles.email is typed by the provider into step 1 and is never
-- verified. Anyone can put a colleague's, a competitor's, or a stranger's
-- address there. Sending application status to it would hand a third party the
-- provider's review progress, so it is a display and contact field only.
--
-- The authoritative recipient is the address on the Supabase Auth identity: it
-- is the address that received the magic link, so holding it is what proves the
-- account. This migration exposes that address to the application under an
-- explicit authorization check, and keeps the app_users mirror from drifting.

-- ---------------------------------------------------------------------------
-- Keep the app_users mirror in step with auth.users
-- ---------------------------------------------------------------------------

-- handle_new_auth_user() copies the address once, at signup. A later address
-- change in Supabase Auth left app_users showing the old one forever, which is
-- what the admin UI displays.
create or replace function sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update app_users set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function sync_auth_user_email();

-- ---------------------------------------------------------------------------
-- The verified address for one professional
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER, because auth.users is not readable by the application
-- roles. That makes the authorization check inside the body the only thing
-- standing between a caller and every address in the system, so it is written
-- as a filter on the row rather than as a branch that could fall through.
--
-- email_confirmed_at is required: an address that was never confirmed has not
-- been proven to belong to whoever is using the account.
create or replace function verified_auth_email(p_professional_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
  from professional_profiles p
  join auth.users u on u.id = p.user_id
  where p.id = p_professional_id
    and u.email_confirmed_at is not null
    and (is_admin() or owns_professional(p.id));
$$;

comment on function verified_auth_email(uuid) is
  'The confirmed Supabase Auth address for a professional. Readable by that professional or by an admin. Use this for anything sent to a provider about their application; professional_profiles.email is self-entered and unverified.';

-- Only signed-in principals; the check inside still decides which row, if any,
-- comes back.
--
-- `anon` has to be revoked by name. Supabase's default privileges grant EXECUTE
-- on new public functions directly to anon, authenticated and service_role, and
-- `revoke from public` removes only the PUBLIC pseudo-role's grant — it leaves
-- those alone. Verified by calling the RPC unauthenticated: it was reachable
-- until this line existed, and the body's filter was the only thing stopping
-- it.
revoke all on function verified_auth_email(uuid) from public;
revoke all on function verified_auth_email(uuid) from anon;
grant execute on function verified_auth_email(uuid) to authenticated;
