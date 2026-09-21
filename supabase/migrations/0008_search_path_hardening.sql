-- Close a search-path hijack in every SECURITY DEFINER function.
--
-- All of them were declared `set search_path = public`, which looks safe and is
-- not. PostgreSQL searches the session's temporary schema *first* for relation
-- names whenever pg_temp is not itself listed in the path — so an unqualified
-- `app_users` inside a definer function resolves to a caller-created temp table
-- in preference to the real one.
--
-- Demonstrated against this database before the change:
--
--   set role authenticated;
--   select is_admin();                            -- false
--   create temp table app_users (id uuid, email text, role text);
--   insert into app_users values (auth.uid(), 'x', 'ADMIN');
--   select is_admin();                            -- true
--
-- is_admin() is what every admin-side RLS policy and every column guard rests
-- on, so that is a full authorization bypass for anyone who can run
-- `create temp table` on this database. PostgREST does not expose a way to do
-- that today, which is what keeps it off the live attack surface — but the
-- authorization model must not depend on a client happening to be unable to
-- issue a statement.
--
-- Naming pg_temp explicitly, last, makes the real public objects win.
-- Ownership of the definer functions is unchanged; only resolution order is.

alter function acting_with_admin_rights()        set search_path = public, pg_temp;
alter function guard_application_columns()       set search_path = public, pg_temp;
alter function guard_credential_columns()        set search_path = public, pg_temp;
alter function guard_disclosure_columns()        set search_path = public, pg_temp;
alter function guard_insurance_columns()         set search_path = public, pg_temp;
alter function guard_profile_columns()           set search_path = public, pg_temp;
alter function guard_user_role()                 set search_path = public, pg_temp;
alter function handle_new_auth_user()            set search_path = public, pg_temp;
alter function is_admin()                        set search_path = public, pg_temp;
alter function owns_professional(uuid)           set search_path = public, pg_temp;
alter function sync_auth_user_email()            set search_path = public, pg_temp;
alter function verified_auth_email(uuid)         set search_path = public, pg_temp;

-- The append-only guard is not SECURITY DEFINER, but it reads nothing and
-- raises unconditionally; pinning it costs nothing and keeps the rule uniform.
alter function reject_review_event_mutation()    set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- EXECUTE privileges
-- ---------------------------------------------------------------------------

-- Trigger functions are invoked by the trigger machinery, which does not
-- consult EXECUTE on the calling role. Nothing legitimately calls these by
-- name, so nobody needs the privilege.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'guard_application_columns()',
    'guard_credential_columns()',
    'guard_disclosure_columns()',
    'guard_insurance_columns()',
    'guard_profile_columns()',
    'guard_user_role()',
    'handle_new_auth_user()',
    'sync_auth_user_email()',
    'reject_review_event_mutation()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end $$;

-- is_admin(), owns_professional() and acting_with_admin_rights() stay callable:
-- RLS policy expressions are evaluated as the querying role, so revoking these
-- would make every protected table unreadable. They disclose only a boolean
-- about the caller, which the caller already knows.
