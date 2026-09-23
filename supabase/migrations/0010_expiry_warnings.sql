-- Thirty days' notice before a credential or policy lapses.
--
-- Only the warning is decided. What happens on the day something actually
-- expires — immediate delisting, a grace period, advance suspension — is an
-- open product and legal question, so nothing here enforces anything. An
-- expired credential already blocks submission and approval through the
-- readiness engine; this gives the provider notice beforehand.
--
-- Two things make this safe to run daily:
--
--   1. expiry_warning_sent_for records *which* expiration date was warned
--      about, not merely that a warning went out. Renewing changes
--      expiration_date, which re-arms the warning by itself — no trigger, and
--      no way for a renewed credential to stay permanently silenced.
--
--   2. The job selects, sends, then marks. Marking first would lose a warning
--      whenever the mail provider was down; this way the worst case is a
--      duplicate tomorrow, which is the right direction to fail in.
--
-- Authentication deliberately avoids the service_role key. A scheduled job has
-- no user session, so it cannot pass RLS — the usual answer is to hand the
-- deployment a key that owns the entire database. Instead the two functions
-- below are the only elevated surface, they are gated on a shared secret, and
-- the caller needs nothing beyond the already-public anon key. A leak of the
-- secret exposes exactly these two functions rather than everything.
--
-- The secret is NOT in this file. It lives in a table with row level security
-- and no policies at all, so no role reaches it by any path except the definer
-- function below. Set it once per environment:
--
--   insert into cron_secrets (name, secret) values ('expiry', '<random>')
--     on conflict (name) do update set secret = excluded.secret;
--
-- Unset, both functions refuse to run.

begin;

alter table credentials add column expiry_warning_sent_for date;
alter table insurance_policies add column expiry_warning_sent_for date;

comment on column credentials.expiry_warning_sent_for is
  'The expiration_date a warning was last sent about. Renewal changes expiration_date and re-arms the warning.';

-- ---------------------------------------------------------------------------
-- Shared secret
-- ---------------------------------------------------------------------------

create table cron_secrets (
  name text primary key,
  secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS on, and deliberately no policies: row level security with nothing granting
-- access denies everyone. The definer function below is the only way in.
alter table cron_secrets enable row level security;
revoke all on table cron_secrets from public, anon, authenticated;

comment on table cron_secrets is
  'Shared secrets for scheduled jobs. No RLS policy exists on purpose; only SECURITY DEFINER functions read it. Never expose through PostgREST.';

create function expiry_cron_authorized(p_secret text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  expected text;
begin
  select secret into expected from cron_secrets where name = 'expiry';

  -- Fails closed. A null comparison is not false but null, which an `if` would
  -- treat as false and let an unconfigured database through.
  if expected is null or expected = '' then
    return false;
  end if;
  return p_secret is not null and p_secret = expected;
end;
$$;

revoke all on function expiry_cron_authorized(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What is due
-- ---------------------------------------------------------------------------

create function due_expiry_warnings(p_secret text, p_within_days int default 30)
returns table (
  professional_id uuid,
  recipient text,
  provider_name text,
  item_kind text,
  item_id uuid,
  item_label text,
  expiration_date date
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not expiry_cron_authorized(p_secret) then
    raise exception 'unauthorized';
  end if;

  return query
  -- Only applications where a lapse actually matters. A draft nobody has
  -- submitted, or one already rejected, is not worth chasing someone about.
  with live as (
    select a.professional_id
      from professional_applications a
     where a.status in ('SUBMITTED', 'CREDENTIAL_REVIEW', 'COMPLIANCE_REVIEW',
                        'NEEDS_INFORMATION', 'APPROVED')
  ),
  items as (
    select c.professional_id, 'CREDENTIAL'::text as kind, c.id,
           c.credential_name as label, c.expiration_date, c.expiry_warning_sent_for
      from credentials c
     where c.expiration_date is not null
    union all
    select i.professional_id, 'INSURANCE'::text, i.id,
           i.carrier_name || ' ' || replace(lower(i.insurance_type), '_', ' '),
           i.expiration_date, i.expiry_warning_sent_for
      from insurance_policies i
     where i.expiration_date is not null
  )
  -- auth.users.email is varchar(255); the cast keeps the declared return
  -- type honest rather than failing at call time.
  select p.id, u.email::text, coalesce(p.display_name, p.legal_first_name, 'there'),
         it.kind, it.id, it.label, it.expiration_date
    from items it
    join live l on l.professional_id = it.professional_id
    join professional_profiles p on p.id = it.professional_id
    join auth.users u on u.id = p.user_id
   where it.expiration_date >= current_date
     and it.expiration_date <= current_date + p_within_days
     -- Already warned about *this* expiry. A renewal changes the date and
     -- makes this comparison unequal again.
     and it.expiry_warning_sent_for is distinct from it.expiration_date
     -- An address nobody confirmed proves nothing about who holds it.
     and u.email_confirmed_at is not null
   order by p.id, it.expiration_date;
end;
$$;

revoke all on function due_expiry_warnings(text, int) from public, authenticated;
grant execute on function due_expiry_warnings(text, int) to anon;

-- ---------------------------------------------------------------------------
-- Recording what went out
-- ---------------------------------------------------------------------------

create function mark_expiry_warnings_sent(
  p_secret text,
  p_credential_ids uuid[],
  p_policy_ids uuid[]
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  marked int := 0;
  touched int;
begin
  if not expiry_cron_authorized(p_secret) then
    raise exception 'unauthorized';
  end if;

  update credentials
     set expiry_warning_sent_for = expiration_date
   where id = any (coalesce(p_credential_ids, '{}'::uuid[]));
  get diagnostics touched = row_count;
  marked := marked + touched;

  update insurance_policies
     set expiry_warning_sent_for = expiration_date
   where id = any (coalesce(p_policy_ids, '{}'::uuid[]));
  get diagnostics touched = row_count;
  marked := marked + touched;

  return marked;
end;
$$;

revoke all on function mark_expiry_warnings_sent(text, uuid[], uuid[]) from public, authenticated;
grant execute on function mark_expiry_warnings_sent(text, uuid[], uuid[]) to anon;

commit;
