# Supabase setup & onboarding smoke test

Everything below has to pass before this is merged as production-ready. The
database layer is already covered by automated tests (`npm run test:db`); what is
*not* yet proven is the browser flow end to end, which is what this checklist is
for.

Budget about 45 minutes.

---

## Part 1 — Create the project

1. Create a Supabase project. Note the region; keep it close to Boston (`us-east-1`).
2. **Project Settings → API**, copy:
   - Project URL
   - `anon` / publishable key
3. In the repo:

   ```bash
   cp .env.local.example .env.local
   ```

   Fill in both values. Do not put the `service_role` key in this file — the app
   never uses it, and anything in `NEXT_PUBLIC_*` reaches the browser.

---

## Part 2 — Run the migrations

Run each file in **SQL Editor**, in order. They are not idempotent, so run each
exactly once.

| # | File | What it creates |
|---|------|-----------------|
| 1 | `supabase/migrations/0001_professional_onboarding.sql` | 16 tables, constraints, `updated_at` triggers |
| 2 | `supabase/migrations/0002_rls.sql` | RLS policies, private storage bucket |
| 3 | `supabase/migrations/0003_seed_capabilities.sql` | capability reference data |
| 4 | `supabase/migrations/0004_column_authorization.sql` | column-level authorization triggers |

**0004 is a security migration, not an optional extra.** Without it a provider
can set their own credential to `VERIFIED` and their own listing to `ACTIVE`.

Verify:

```sql
select count(*) from capabilities;                                    -- 35
select count(*) from pg_tables
 where schemaname = 'public' and rowsecurity = false;                 -- 0
select id, public from storage.buckets;                               -- professional-documents | false
```

---

## Part 3 — Auth configuration

1. **Authentication → Providers → Email**: enable it. For the smoke test turn
   **Confirm email** off so magic links land faster.
2. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: add `http://localhost:3000/auth/callback`

   The magic link fails silently without that redirect entry — it is the most
   common setup mistake here.
3. Confirm the storage bucket `professional-documents` shows **Private**.

---

## Part 4 — Create the two accounts

```bash
npm install
npm run dev
```

1. Visit `http://localhost:3000/login`, enter your provider address, open the
   emailed link. You should land on step 1.
2. Repeat in a **different browser profile or private window** with your admin
   address. Two sessions in the same browser will fight over the auth cookie.
3. Promote the admin — the app has no UI for this on purpose:

   ```sql
   update app_users set role = 'ADMIN' where email = 'you+admin@dexafit.com';
   ```

4. Confirm: the admin window can open `/admin/professionals`; the provider
   window is redirected away from it.

---

## Part 5 — Provider flow

Work through the wizard as the provider. Tick each behaviour:

- [ ] **Step 1** rejects a bio under 100 characters and requires a photo.
- [ ] Pick **Personal trainer**. Continue.
- [ ] **Autosave / refresh:** hard-refresh mid-wizard. Your answers persist and
      you return to the same step.
- [ ] **Resume:** close the tab, reopen `/professionals/onboarding`. It resumes
      at the first incomplete step.
- [ ] **Step 2** hides address fields for Virtual-only, requires them for
      In-person.
- [ ] **Step 3** asks for a *national certification* and *CPR/AED*, both labelled
      **DexaFit marketplace requirement** — neither may say "state license".
- [ ] Try to continue with no credentials: blocked server-side.
- [ ] **Upload rejection:** rename any `.zip` or `.dmg` to `license.pdf` and
      upload it. Must be rejected — the content type comes from the file's magic
      bytes, not its name.
- [ ] Upload a real PDF. The filename appears as a link.
- [ ] **Step 4** requires a certificate of insurance. Answer **yes** to a
      compliance question; an explanation becomes required.
- [ ] **Step 5** offers no clinical scopes (no psychotherapy, no medical
      nutrition therapy) for a trainer.
- [ ] **Steps 6–7** require at least one service and one location.
- [ ] **Step 8** shows the draft-terms warning and requires all 8 attestations.
- [ ] **Step 9** shows every section; Edit links jump back correctly.
- [ ] Submit. You land on the status page as `SUBMITTED`.

### Profession-specific checks

Worth doing at least the LCSW one — it is the rule most likely to be wrong.

- [ ] **LCSW** → warns it cannot be listed as independent private practice, asks
      for supervisor details, and the status page shows the restriction.
- [ ] **Psychologist, HSP = No** → restriction notice appears.
- [ ] **Psychologist, HSP = Yes** → no restriction.
- [ ] **Nurse practitioner** → asks for RN licence, APRN authorisation, national
      certification, and an APRN category.
- [ ] **Dietitian** → asks for a state licence *and* separately whether they hold
      RD/RDN. The two must not be conflated.

---

## Part 6 — Admin review

In the admin window:

- [ ] The application appears in the queue with credential and insurance status.
- [ ] Open it. **Approve is disabled** and the blockers are listed.
- [ ] Click a credential document — it opens through a signed URL. Copy that URL,
      wait ~60s, open it again: it must now be **expired**.
- [ ] Paste the document URL into the *provider's* window: denied.
- [ ] Verify each credential (add a source URL) and the insurance policy.
- [ ] Resolve the compliance disclosure.
- [ ] Approve. The provider's `marketplace_status` becomes `ACTIVE`.
- [ ] The review history shows every action with your name and timestamp.

---

## Part 7 — The re-review loop

Back in the provider window:

- [ ] Edit the credential number on an already-verified credential.
- [ ] That credential drops from `VERIFIED` to `PENDING`.
- [ ] The application returns to `CREDENTIAL_REVIEW`.
- [ ] `marketplace_status` drops back to `INACTIVE` — an approved listing must not
      survive an unreviewed credential change.
- [ ] The admin's note on that credential is still there.
- [ ] The history shows a `REOPENED_FOR_REVIEW` entry.

---

## Part 8 — Authorization spot-checks in the browser

These duplicate `npm run test:db`, but confirm the deployed project (not just
local Postgres) behaves. Run in **SQL Editor**, which bypasses RLS, to read the
true state after trying each from the app.

- [ ] As the provider, sign in and open the browser console:

      ```js
      const { createClient } = await import('@supabase/supabase-js');
      // using the anon key from .env.local and the provider's own session
      ```

      Simpler equivalent: run `npm run test:db` against the project's connection
      string (Project Settings → Database → Connection string, session mode):

      ```bash
      psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
      ```

      All 24 assertions must print `ok`. The suite rolls itself back and leaves
      no fixtures behind.

- [ ] Confirm a second provider account cannot see the first one's application
      anywhere in the UI.

---

## Known gaps to keep in mind while testing

- Credential expiry is modelled and blocks approval, but nothing sweeps for
  newly-expired credentials on a schedule. An approved professional whose licence
  lapses tomorrow stays `ACTIVE` until something touches the record.
- Attestation text is placeholder pending legal review.
- Organisation support stops at storing the record and membership.
- `service_role` bypasses both RLS and the 0004 triggers by design. Keep that key
  out of the app; it is for migrations and admin tooling only.

---

## If something fails

Report which checkbox, what you expected, and what happened. The database-layer
guarantees are regression-tested, so a failure here is most likely in the wizard
or in the Supabase project configuration rather than in the schema.
