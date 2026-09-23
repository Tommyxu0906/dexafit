-- Remove the demo applicants.
--
--   npm run seed:demo:clear
--
-- Only the fictional accounts go. Every address created by `demo.sql` ends in
-- @demo.dexafit.invalid, and that suffix is the entire selector — a real
-- provider cannot match it, because `.invalid` is reserved by RFC 2606 and
-- nobody can register an address there.
--
-- Deliberately NOT keyed to the fixed demo ids the way `demo.sql` is: if an
-- earlier seed ran with different ids, keying on ids would leave rows behind
-- while reporting success. The address suffix catches every generation.
--
-- The seed never uploads bytes to Storage (SQL cannot), so the document rows
-- point at keys with no object behind them and there is nothing in the bucket
-- to clean up. If that ever changes, delete the objects before the rows —
-- afterwards there is no longer a record of which keys to delete.

\if :{?allow_demo_clear}
\else
\warn ''
\warn '  Refusing to run.'
\warn ''
\warn '  This deletes accounts from whatever database it is pointed at.'
\warn '  Run it deliberately:'
\warn ''
\warn '      npm run seed:demo:clear'
\warn ''
\quit
\endif

begin;

-- Say what is about to go, so a wrong database is visible in the output rather
-- than discovered afterwards.
select u.email, p.legal_first_name || ' ' || coalesce(p.legal_last_name, '') as name
  from auth.users u
  left join professional_profiles p on p.user_id = u.id
 where u.email like '%@demo.dexafit.invalid'
 order by u.email;

-- The audit trail is append-only and refuses the cascading delete, which is the
-- guarantee doing its job. The trigger is off only for the length of this
-- transaction and restored by the commit.
--
-- Worth knowing: the same trigger means a real provider's account cannot be
-- deleted either. A retention or erasure request will need a decided answer,
-- because the audit history is deliberately not erasable by ordinary means.
alter table application_review_events disable trigger reject_review_event_mutation;

-- app_users cascades from auth.users, and everything else from app_users.
delete from auth.users where email like '%@demo.dexafit.invalid';

alter table application_review_events enable trigger reject_review_event_mutation;

commit;
