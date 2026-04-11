# CoFoundry

Production-minded MVP for a founder and collaborator matching platform, organized as an npm workspace monorepo and built on top of `antfu/vitesse-nuxt`.

## Workspace layout

- `front-end`: the Nuxt 4 application, including routes, layouts, UI, server routes, typed shared domain models, and Vitest coverage
- `back-end`: operational tooling for seed generation, Supabase migrations, and a lightweight Node service surface for backend health and environment inspection

## Stack

- Nuxt 4
- Vue 3
- Vite
- TypeScript
- Pinia
- UnoCSS
- VueUse
- Nitro server routes inside the frontend workspace
- Supabase-ready schema and seed path
- Stripe-ready checkout route with mock billing mode
- npm workspaces at the repo root

## Product focus

CoFoundry is not a freelance marketplace and not a Fiverr clone. It is centered on forming startup teams:

- Founders can publish startup opportunities and find co-founders or key collaborators
- Skilled builders and operators can discover companies to join
- Mutual interest unlocks messaging
- Structured proposals and editable agreement templates are first-class workflow surfaces
- A future investment module exists behind a feature flag and is disabled by default

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env
```

3. Refresh the local mock seed snapshot:

```bash
npm run seed
```

4. Start the frontend workspace:

```bash
npm run dev
```

5. Optional: start the backend workspace service in a separate terminal:

```bash
npm run server
```

6. Open [http://localhost:3000](http://localhost:3000)

The frontend workspace loads the root `.env` file via `--dotenv ../.env`, and the backend workspace reads the same root `.env` explicitly.

## Demo accounts

- Founder demo: `olivia@cofoundry.dev` / `founder123`
- Collaborator demo: `malik@cofoundry.dev` / `builder123`
- Admin demo: `ava@cofoundry.dev` / `admin123`

Google and GitHub buttons work in local mock mode by signing into seeded demo identities.

## Root scripts

```bash
npm run dev
npm run server
npm run server:once
npm run serve
npm run preview
npm run generate
npm run build
npm run seed
npm run lint
npm run lint-fix
npm run typecheck
npm run test:run
```

## Environment modes

### Mock backend mode

Default:

- `NUXT_PUBLIC_BACKEND_MODE="mock"`
- `NUXT_PUBLIC_BILLING_MODE="mock"`

Behavior:

- Auth runs through local cookie-backed mock routes
- Workspace data comes from realistic seeded demo data with local persistence via `useStorage`
- Billing uses a mocked checkout redirect and local entitlement updates
- The full app works without Supabase or Stripe keys

### Supabase-backed mode

Set:

- `NUXT_PUBLIC_BACKEND_MODE="supabase"`
- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Then:

1. Apply the SQL migration in `back-end/supabase/migrations/20260410190000_initial.sql`
2. Run `npm run seed`

`npm run seed` always writes `.data/mock-seed.json`, and when Supabase service credentials are present it also upserts the workspace seed into the database tables defined by the migration. If `SEED_SUPABASE_AUTH` is not `"false"`, it also attempts to create the demo auth users in Supabase Auth.

## Billing notes

The frontend checkout route lives at `front-end/server/api/billing/checkout.post.ts`.

- In mock mode it redirects back into `/app/billing?checkout=success&plan=...`
- In Stripe mode it creates a Stripe Checkout Session using env-driven price IDs
- The MVP treats subscriptions as SaaS access. There is no mandatory platform equity in billing

## Feature-flagged investment module

The route exists at `front-end/app/pages/app/investment.vue`.

- Disabled by default with `NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE="false"`
- When enabled, startups can submit an investment application
- The module is intentionally separated from the main paid SaaS workflow
- It does not implement cap table management and does not force platform equity in V1

## Tests

Included coverage is intentionally lightweight:

- utility tests for discovery filtering and contract generation
- component tests for reusable UI primitives

Run:

```bash
npm run test:run
```

## Structure

Key areas:

- `front-end/app/pages`: marketing, auth, app, and admin routes
- `front-end/app/stores`: auth, workspace, and toast state
- `front-end/shared`: typed domain model, marketing content, seed data, and shared utilities
- `front-end/server`: auth, contact, and billing routes
- `back-end/scripts/seed.ts`: seed snapshot plus optional Supabase seeding
- `back-end/supabase/migrations`: SQL schema and migrations

## Notes

- Contract templates include a clear legal-review disclaimer and are not legal advice
- Direct contact is hidden until a connection is mutual
- The app shell supports dark and light mode
- Mock mode is the primary local-development path
