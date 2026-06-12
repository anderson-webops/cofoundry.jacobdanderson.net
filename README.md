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
- Stripe-ready checkout, webhook sync, and customer portal routes with mock billing mode
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

The frontend workspace loads the root `.env` file via `--dotenv ../.env`. The backend `server`, `server:once`, and `seed` scripts optionally read `../.env` for local development, while `npm run -w back-end start` and `node dist/server.js` use only the host process environment.

## Environment model

CoFoundry is intentionally split into public runtime config and server-only secrets.

Public runtime config:

- `NUXT_PUBLIC_APP_URL`
- `NUXT_PUBLIC_BACKEND_MODE`
- `NUXT_PUBLIC_BILLING_MODE`
- `NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE`
- `NUXT_PUBLIC_SUPPORT_EMAIL`
- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_ANON_KEY`
- `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NUXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY`
- `NUXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY`

Server-only secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SESSION_SIGNING_SECRET`
- `COFOUNDRY_OPERATIONS_TOKEN`
- `COFOUNDRY_LOCAL_DATA_DIR`
- `COFOUNDRY_OPERATIONS_RETENTION_LIMIT`
- `COFOUNDRY_ACCESS_REQUEST_RETENTION_LIMIT`
- `COFOUNDRY_PRIVACY_REQUEST_RETENTION_LIMIT`
- `CONTACT_FROM_EMAIL`
- `CONTACT_FROM_NAME`
- `CONTACT_TO_EMAIL`
- `CONTACT_BCC_EMAIL`
- `CONTACT_USE_SENDMAIL`
- `CONTACT_SENDMAIL_PATH`
- `CONTACT_SMTP_HOST`
- `CONTACT_SMTP_PORT`
- `CONTACT_SMTP_SECURE`
- `CONTACT_SMTP_REQUIRE_TLS`
- `CONTACT_SMTP_USER`
- `CONTACT_SMTP_PASS`

If a non-mock mode is enabled without the required public values and server secrets, startup fails with a clear error. In mock mode, the current production-safe mock behavior remains unchanged.

The public contact form now delivers through the server instead of only validating the payload. For production, prefer SMTP so the envelope sender is explicitly controlled by `CONTACT_FROM_EMAIL`. The current delivery target should remain `contacts@jacobdanderson.net`. To move later to an alias-based outbound pattern, set `CONTACT_FROM_EMAIL` to the sending alias, `CONTACT_TO_EMAIL` to the primary destination, and `CONTACT_BCC_EMAIL` to `contacts@jacobdanderson.net`. `CONTACT_USE_SENDMAIL=true` remains available as a local or fallback transport.

The same server mail transport now powers on-demand unread workspace digests from `/app/inbox`. Scheduled digests are exposed through the worker-authenticated `/api/operations/notification-digests/run` endpoint and should be called by a server cron/timer with `COFOUNDRY_OPERATIONS_TOKEN`. In mock/access-request mode, operations telemetry is persisted to `.data/operations-telemetry.json` by default, or to `COFOUNDRY_LOCAL_DATA_DIR` when set.

Public workspace access requests are durable in mock/access-request mode. `/auth/sign-up` submits access requests into `.data/access-requests.json` by default, admins can review them at `/admin/access-requests`, and issued invites create 30-day invite links that allow account creation without enabling public self-serve signup. Privacy and trust-review requests submitted from account settings are stored in `.data/privacy-requests.json` and reviewed at `/admin/privacy`. Invited local accounts are stored in `.data/local-auth-accounts.json` so sign-in survives server restarts while the site remains in mock backend mode. When Supabase mode is intentionally enabled later, the same route surface writes to the relevant Supabase tables after the latest migrations are applied.

## Local review accounts

- Founder review account: `olivia@cofoundry.dev` / `founder123`
- Collaborator review account: `malik@cofoundry.dev` / `builder123`
- Admin review account: `ava@cofoundry.dev` / `admin123`

Seeded review credentials remain available for local and explicitly enabled staging review environments. They are no longer advertised as one-click review shortcuts in the sign-in UI.

## Root scripts

```bash
npm run dev
npm run server
npm run server:once
npm run serve
npm run preview
npm run generate
npm run build
npm run -w back-end bootstrap-admin
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
- `NUXT_PUBLIC_ENABLE_DEMO_ACCESS="false"`

Behavior:

- In production-facing deployments, CoFoundry behaves as a public marketing shell plus access-request funnel
- Public directories, pricing, legal pages, contact, sitemap, and SEO surfaces remain live
- `/auth/sign-in` and `/auth/sign-up` become intentional access-request pages instead of fake-live account creation
- The private app stays available only in local development or when demo access is explicitly enabled
- Local development still supports cookie-backed mock auth, seeded workspace data, and preview billing flows

Required env:

- `NUXT_PUBLIC_BACKEND_MODE="mock"`
- `NUXT_PUBLIC_BILLING_MODE="mock"`
- `NUXT_PUBLIC_ENABLE_DEMO_ACCESS="false"` for production-facing shells
- No server secrets are required

Optional:

- `NUXT_PUBLIC_ENABLE_DEMO_ACCESS="true"` if you intentionally want seeded review-account flows in a staging environment
- `SESSION_SIGNING_SECRET` if you intentionally enable review accounts in a non-local environment

### Supabase-backed mode

Set:

- `NUXT_PUBLIC_BACKEND_MODE="supabase"`
- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_ANON_KEY`
- `SESSION_SIGNING_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

Then:

1. Apply the SQL migration in `back-end/supabase/migrations/20260410190000_initial.sql`
2. Run `npm run seed`

`npm run seed` always writes `.data/mock-seed.json`, and when `NUXT_PUBLIC_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` are present it also upserts the workspace seed into the database tables defined by the migration. If `SEED_SUPABASE_AUTH` is not `"false"`, it also attempts to create the seeded review auth users in Supabase Auth.

Required env:

- Public:
  `NUXT_PUBLIC_SUPABASE_URL`
  `NUXT_PUBLIC_SUPABASE_ANON_KEY`
- Secret:
  `SESSION_SIGNING_SECRET`
  `SUPABASE_SERVICE_ROLE_KEY`

If those values are missing while `NUXT_PUBLIC_BACKEND_MODE="supabase"`, Nuxt SSR startup and the backend workspace fail fast instead of silently falling back.

### Real production workspace mode

Use this path only when you intend CoFoundry to support real persisted accounts and server-enforced roles.

Required baseline:

- `NUXT_PUBLIC_BACKEND_MODE="supabase"`
- `NUXT_PUBLIC_ENABLE_DEMO_ACCESS="false"`
- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_ANON_KEY`
- `SESSION_SIGNING_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional when self-serve billing is live:

- `NUXT_PUBLIC_BILLING_MODE="stripe"`
- `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NUXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY`
- `NUXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Optional for server-side workers:

- `COFOUNDRY_OPERATIONS_TOKEN`
- `COFOUNDRY_LOCAL_DATA_DIR`
- `COFOUNDRY_OPERATIONS_RETENTION_LIMIT`
- `COFOUNDRY_ACCESS_REQUEST_RETENTION_LIMIT`
- `COFOUNDRY_PRIVACY_REQUEST_RETENTION_LIMIT`

Provisioning after merge:

1. Apply all SQL migrations in `back-end/supabase/migrations/` in timestamp order.
2. Run `npm run seed` against the target Supabase project.
3. Configure `SESSION_SIGNING_SECRET` in the server environment or Vault injection.
4. Enable the desired auth providers in Supabase.
5. Assign the first real admin user server-side before using `/admin`: `BOOTSTRAP_ADMIN_EMAIL=operator@example.com npm run -w back-end bootstrap-admin`. The script requires Supabase mode and the Vault-injected `SUPABASE_SERVICE_ROLE_KEY`; it updates an existing user row and records an admin action.
6. Turn on Stripe env only when checkout and webhook infrastructure are ready.
7. Configure `COFOUNDRY_OPERATIONS_TOKEN` before enabling scheduled digests, backup-run reporting, operational event ingestion, or file-scan callbacks.
8. In mock/access-request mode, ensure the app process can write to `.data/operations-telemetry.json`, `.data/access-requests.json`, `.data/privacy-requests.json`, and `.data/local-auth-accounts.json`, or set `COFOUNDRY_LOCAL_DATA_DIR` to a durable writable host path.

## Production control surfaces

- Sensitive endpoints now have server-side rate limits for auth, contact, billing checkout, collaboration writes, member workspace writes, admin actions, inbox read transitions, data exports, and privacy requests.
- Admin moderation actions persist user suspension, role changes, report status changes, and audit actions in Supabase mode.
- Access-request review has a mock-mode admin queue at `/admin/access-requests` and a Supabase-backed table path for later. Operators can approve, deny, reopen, and issue invite links while Supabase and Stripe remain disabled.
- Account settings include a JSON data export, privacy-request submission, and trust-verification review requests. The settings UI no longer self-awards trust badges.
- Admins can review privacy and trust-review requests at `/admin/privacy` from Supabase mode or the local mock-mode queue. Reviewed/resolved requests create audit actions and user notifications when Supabase persistence is enabled.
- Admins can review `/admin/readiness` for a server-derived launch-readiness view covering environment, session secrets, mail, local persistence, access/privacy queues, backups, scanner status, digest worker evidence, and operational events.
- Supabase migrations include RLS policies for user-owned, participant-owned, admin-only, notification, privacy, file-upload, backup, and operational tables.
- File uploads are represented by server-owned metadata and signed Supabase upload policies against the private `cofoundry-private-files` bucket. A malware/content scanner still needs to run outside the app and report results through `/api/operations/file-scans/:id`.
- Relationship workspaces now have a server read endpoint and `/app/relationships/:id` page that aggregates conversation, trial, proposal, agreement, unread, and next-action state.

Worker-authenticated operations endpoints:

- `POST /api/operations/notification-digests/run` sends unread workspace digests across Supabase users. It accepts `{ "dryRun": true, "maxUsers": 100, "onlyWithUnread": true }` for safe verification.
- `POST /api/operations/backup-runs` records backup job lifecycle events in `backup_runs`.
- `POST /api/operations/events` records deploy, worker, scanner, backup, and monitoring events in `operational_events`.
- `GET /api/operations/file-scans/pending?limit=25` returns pending upload metadata with short-lived signed download URLs for a scanner worker.
- `POST /api/operations/file-scans/:id` records malware/content scan results for uploaded files.

Each endpoint requires `Authorization: Bearer <COFOUNDRY_OPERATIONS_TOKEN>` or `x-cofoundry-operations-token`. The token is intentionally optional at startup so mock production remains unchanged, but the endpoints fail closed if called before the token is configured.

When Supabase is disabled, these endpoints write durable local telemetry rows to `operations-telemetry.json` with a default retention limit of 200 rows per collection. Set `COFOUNDRY_OPERATIONS_RETENTION_LIMIT` to tune that per-collection limit.

Access-request rows are separately retained in `access-requests.json` with a default limit of 500. Privacy and trust-review requests are retained in `privacy-requests.json` with a default limit of 500. Set `COFOUNDRY_ACCESS_REQUEST_RETENTION_LIMIT` and `COFOUNDRY_PRIVACY_REQUEST_RETENTION_LIMIT` to tune those queues, and keep `COFOUNDRY_LOCAL_DATA_DIR` on durable host storage if invite-only mock-mode accounts need to survive deployment restarts.

The server-side handoff prompt for wiring these jobs lives at `docs/server-ai-operations-prompt.md`; first-admin provisioning is covered in `docs/server-ai-admin-bootstrap-prompt.md`; the recurring operator checklist lives at `docs/operations-runbook.md`.

## Billing notes

The frontend checkout route lives at `front-end/server/api/billing/checkout.post.ts`.

- In mock mode it redirects back into `/app/billing?checkout=success&plan=...`
- In Stripe mode it creates a Stripe Checkout Session using env-driven price IDs
- `/api/billing/webhook` verifies Stripe signatures and syncs checkout/subscription updates into the Supabase subscription row
- `/api/billing/portal` creates a Stripe Customer Portal session for self-service billing management
- The MVP treats subscriptions as SaaS access. There is no mandatory platform equity in billing

Stripe mode env requirements:

- Public:
  `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  `NUXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY`
  `NUXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY`
- Secret:
  `STRIPE_SECRET_KEY`
  `STRIPE_WEBHOOK_SECRET`

If `NUXT_PUBLIC_BILLING_MODE="stripe"` is enabled without that configuration, startup fails with a clear error so production never drifts into a half-configured payment state.

Stripe production setup after deploy:

1. Create the Pro and Team monthly Prices and set the public price IDs.
2. Register `https://<production-host>/api/billing/webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
3. Configure the Stripe Customer Portal in the Stripe dashboard before exposing self-service plan management.
4. Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vault-managed or host-managed server env.

## Production secret model

Current deployments can stay in mock mode with no secret-backed services enabled.

- Public env can live in normal env files or deploy-time public environment settings.
- Server-only secrets are expected to come from Vault-managed env files or equivalent host injection later.
- The repo is already wired so that moving from mock mode to Supabase or Stripe is a config change, not another refactor.
- `NUXT_PUBLIC_APP_URL` falls back to `http://localhost:3000` only for local development. Production SSR avoids localhost-style defaults and derives request origin when needed.
- If `NUXT_PUBLIC_BACKEND_MODE="mock"` in a production deployment, the product should stay in marketing-shell mode unless `NUXT_PUBLIC_ENABLE_DEMO_ACCESS="true"` is set deliberately for a staging/demo environment.
- `SESSION_SIGNING_SECRET`, `COFOUNDRY_OPERATIONS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` should stay externalized through Vault-managed or host-managed secret injection, not committed env files.
- Backup and observability migrations create `backup_runs` and `operational_events` tables. Source routes now accept worker reports and persist them locally in mock mode, but the actual backup schedule, restore drill, log drain, and alerting provider are still server/operator provisioning tasks.

## Route surfaces

Public marketing and discovery pages:

- `/`
- `/find-cofounder`
- `/how-it-works`
- `/pricing`
- `/faq`
- `/safety`
- `/terms`
- `/privacy`
- `/contact`
- `/trust`
- `/contracts`
- `/people`
- `/roles`
- `/industries`
- `/stage`
- `/startups`

Private workspace and admin pages:

- `/auth/*`
- `/onboarding`
- `/app/*`
- `/admin/*`

Environment-gated surfaces:

- Review account helpers on `/auth/sign-in` appear only in local development or when `NUXT_PUBLIC_ENABLE_DEMO_ACCESS="true"`.
- Development workspace reset controls on `/app/settings` appear only in local development or when `NUXT_PUBLIC_ENABLE_DEMO_ACCESS="true"`.
- `/app/investment` remains feature-flagged behind `NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE`.

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
