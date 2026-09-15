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
npm test           # vitest
```

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
