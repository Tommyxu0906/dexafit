# DexaFit Professional Marketplace

Onboarding and credentialing for the health professionals DexaFit refers scanned
customers to. Massachusetts-first, nationwide-ready.

The original interview concept demo lives in [`concept/`](concept/index.html) (static,
no backend).

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript, Tailwind v4)
- [Supabase](https://supabase.com) — Postgres, Auth (magic link), private Storage
- Zod for validation shared between client and server
- Vitest for the credentialing and readiness rules

## Setup

1. Create a Supabase project.
2. Copy `.env.local.example` to `.env.local` and fill in the project URL and anon key
   (Project Settings → API).
3. Run the SQL in `supabase/migrations/` in order, via the Supabase SQL editor or CLI.
4. Grant yourself admin access:
   `update app_users set role = 'ADMIN' where email = 'you@dexafit.com';`
5. `npm install && npm run dev` → http://localhost:3000

## Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest — rules engine and server actions
npm run test:db    # psql — RLS and column authorization, against SUPABASE_DB_URL
npm run seed:demo  # replace the four demo applicants (never runs by accident)
npm run audit:documents   # read-only report on orphaned uploads
```

The psql-backed commands read `SUPABASE_DB_URL` from `.env.local` and find
`psql` themselves; see [scripts/psql.sh](scripts/psql.sh).

Before merging, work through [docs/smoke-test.md](docs/smoke-test.md): the
database layer is regression-tested but the browser flow is not.

## Demo data

`npm run seed:demo` writes four fictional applicants, sitting at different
points in the queue:

| | | |
| --- | --- | --- |
| Marcus Whitfield | personal trainer | everything verified — Approve is unlocked |
| Elena Vasquez | physical therapist | state licence still to verify |
| Rachel Kim | LICSW | licensed, independently listable |
| Daniel Oyelaran | LCSW | same discipline, *not* independently listable, forced to manual review |

The last two are the pair worth showing: same field, different licence,
different outcome, decided by rule rather than by whoever is reviewing.

Re-running replaces them and touches nothing else. It refuses to run without
an explicit flag, which `npm run seed:demo` supplies, so it cannot be triggered
by accident. Every address is `@demo.dexafit.invalid` — `.invalid` is reserved
by RFC 2606 and cannot resolve, so a stray notification can never reach a real
person.

One limitation: document *rows* are seeded but the files behind them are not,
because bytes cannot be written to Storage over SQL. The review page lists each
document; downloading one will fail. Upload a file through the wizard if a
walkthrough needs a working download.

Deploying is [docs/deployment.md](docs/deployment.md).

## Structure

- `src/lib/domain` — the rules engine, and the only place profession logic lives
  - `requirements.ts` — credential requirements per profession per jurisdiction
  - `capabilities.ts` — what each profession may claim (scope enforcement)
  - `readiness.ts` — deterministic approval readiness
- `src/lib/actions` — server actions (all writes; ownership derived from the session)
- `src/lib/data` — queries and row types
- `src/app/professionals/onboarding` — 9-step provider wizard
- `src/app/admin/professionals` — internal credential review
- `supabase/migrations` — schema, RLS, capability seeds

## Two rules worth knowing before you edit

**Legal vs. marketplace requirements are separate flags.** A personal trainer's national
certification is a DexaFit marketplace requirement, not a Massachusetts license, and the
UI must never present it as one. See `legalRequirement` / `marketplaceRequirement` in
`src/lib/domain/requirements.ts`.

**Jurisdiction is always `(country, state)`.** There are no `ma_*` columns. Adding a state
means adding rules to `RESEARCHED_JURISDICTIONS` and the requirements config — not
touching the schema or the wizard.

**Authorization is enforced in the database, not in the UI.** RLS decides which rows a
user reaches; the triggers in `0004_column_authorization.sql` decide which *columns* they
may write. A professional can only move themselves down the privilege ladder — never set
their own credential to verified, their own application to approved, or their own listing
to active. Keep new reviewer-owned columns covered by those triggers, and keep
`supabase/tests/security.sql` passing.
