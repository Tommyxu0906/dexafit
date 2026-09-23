# Deploying DexaFit onboarding

Written for a Vercel + Supabase + Resend production setup. Nothing here has
been run yet — the application has only ever run on localhost — so treat the
first pass as a dry run and check `/api/health` after each stage.

Work through the sections in order. Email depends on DNS, and Supabase Auth
depends on the production URL existing, so doing these out of order means
redoing them.

---

## 1. Resend: verify a sending domain

**Do this first — DNS propagation is the only step with a waiting period, and
two other things are blocked on it.**

Today the app sends from `onboarding@resend.dev`, Resend's shared domain. That
has two consequences that make it unusable for real providers:

- it **only delivers to the address that owns the Resend account**, so adding a
  second person to `ADMIN_NOTIFICATION_EMAILS` silently fails
- shared-domain mail has no sender reputation of its own and lands in spam

In Resend → Domains, add the DexaFit domain and publish the three records it
gives you:

| Record | Purpose |
| --- | --- |
| SPF (TXT) | authorises Resend to send as this domain |
| DKIM (TXT or CNAME) | signs each message so the recipient can prove it was not altered |
| DMARC (TXT) | tells the recipient what to do when SPF or DKIM fails |

Wait for Resend to show the domain **verified**, then set `EMAIL_FROM`.

> Requires access to the DexaFit domain's DNS. If that sits with someone else,
> this is the item to hand them first.

## 2. Supabase: custom SMTP

Supabase's built-in email sender is rate limited to a handful of messages per
hour and is documented as **not for production**. Magic-link login is the only
way into this application, so leaving the default in place means the first
handful of providers to sign in per hour succeed and the rest silently get
nothing.

Once the domain is verified, point Supabase at it:

**Authentication → Emails → SMTP Settings**

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a Resend API key |
| Sender email | an address on the verified domain |
| Sender name | DexaFit |

Then raise the rate limit under **Authentication → Rate Limits**, which stays
at the built-in sender's ceiling until you do.

## 3. Supabase: production URLs

**Authentication → URL Configuration**

- **Site URL**: the production origin, e.g. `https://app.dexafit.com`
- **Redirect URLs**: add `https://app.dexafit.com/auth/callback`

The login form builds its callback from `window.location.origin`, so every
origin the app is served from needs to be on this list — including a Vercel
preview domain if you want magic links to work in previews. A link that is not
on the list fails at the callback, which looks to the user like an expired
link.

## 4. Supabase: database and storage

- [ ] Run every migration in `supabase/migrations/` in filename order.
- [ ] Confirm the `professional-documents` bucket exists and is **private**.
      It holds licences and insurance certificates; a public bucket would make
      every one of them a permanent URL.
- [ ] Run `npm run test:db` against the production database. It rolls itself
      back and leaves no fixtures. All 38 assertions must pass — this is what
      proves RLS, the column-authorization triggers and the search_path
      hardening actually took.
- [ ] Take note of the backup policy for the plan you are on. The free tier's
      retention is short, and this database holds the only copy of applicants'
      credential records.

## 5. Vercel: environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Production project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon key, not the service role key |
| `APP_URL` | **yes in production** | e.g. `https://app.dexafit.com` |
| `RESEND_API_KEY` | for email | From resend.com/api-keys |
| `ADMIN_NOTIFICATION_EMAILS` | for email | Comma-separated |
| `EMAIL_FROM` | after step 1 | Address on the verified domain |
| `SUPPORT_EMAIL` | optional | Reply-to on provider email; defaults to the first admin address |
| `EXPIRY_CRON_SECRET` | for the daily job | Must match the `cron_secrets` row; see below |
| `SENTRY_DSN` | optional | Enables error forwarding; the app runs fine without it |

`APP_URL` is refused in production if it is missing or points at localhost, so
a forgotten value shows up as notifications skipped with a stated reason rather
than as email nobody can click. `/admin/notifications` shows the current state.

**The `service_role` key does not belong in Vercel.** It bypasses RLS entirely.
It is for migrations and admin tooling run from a laptop.

### Build settings

Defaults work. The build needs no environment variables — every route is
server-rendered on demand, so nothing reads Supabase or Resend configuration at
build time, and CI verifies that by building with no environment file present.

## 6. The daily expiry-warning job

`vercel.json` schedules `/api/cron/expiry-warnings` once a day at 13:00 UTC.
It emails providers whose credentials or insurance lapse within 30 days.

It authenticates with a shared secret rather than the `service_role` key, so
nothing that owns the database goes near the deployment. Set the same value in
two places:

```sql
insert into cron_secrets (name, secret) values ('expiry', '<random>')
  on conflict (name) do update set secret = excluded.secret;
```

and as `EXPIRY_CRON_SECRET` in Vercel. Generate it with `openssl rand -hex 32`.
Unset in either place, the job refuses to run rather than running unprotected.

- [ ] Secret set in the database and in Vercel, and they match.
- [ ] `curl https://<domain>/api/cron/expiry-warnings` with no header returns 401.
- [ ] With `Authorization: Bearer <secret>` it returns a JSON summary.

> Vercel's Hobby plan runs cron jobs once per day, which is what this needs. A
> plan change is not required for it.

## 7. After deploying

- [ ] `GET /api/health` returns `{"status":"ok"}` with all four checks true.
      `degraded` means something in the table above is missing; `down` means
      the database did not answer.
- [ ] Sign in with a magic link on the production domain.
- [ ] Open `/admin/notifications` and send a test notification.
- [ ] Submit one application end to end and confirm both emails arrive — the
      admin notification and the provider's confirmation — and that the link in
      each points at the production domain, not localhost.

---

## Still open before real providers

These are not deployment steps; they are the things a production deployment
would expose.

- **Legal text is a placeholder.** The attestations are marked as pending legal
  review and have not been read by a lawyer.
- **No expiry sweep.** A credential that lapses after approval leaves the
  provider listed. What should happen — immediate delisting, advance warning, a
  grace period — is an open product and legal question.
- **Suspension is not notified.** A suspended provider is delisted without an
  email, because what they should be told has not been decided.
- **No rate limiting** on the document upload endpoint.
- **No data retention policy** for the credential documents of applicants who
  were rejected or who never finished.
