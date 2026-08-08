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
- Team and Studio workspaces coordinate seats, ventures, projects, decisions, searches, policies, approvals, and counsel queues
- An optional fundraising and investment-review workspace exists behind a feature flag and is disabled by default

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
- `COFOUNDRY_ADMIN_AUDIT_RETENTION_LIMIT`
- `COFOUNDRY_COLLABORATION_RETENTION_LIMIT`
- `COFOUNDRY_CONTRACT_LEGAL_REVIEW_RETENTION_LIMIT`
- `COFOUNDRY_INVESTMENT_PROGRAM_APPROVED`
- `COFOUNDRY_FILE_SCANNER_COMMAND`
- `COFOUNDRY_PRIVACY_REQUEST_RETENTION_LIMIT`
- `CONTACT_FROM_EMAIL`
- `CONTACT_FROM_NAME`
- `CONTACT_TO_EMAIL`
- `CONTACT_BCC_EMAIL`
- `CONTACT_USE_SENDMAIL`
- `CONTACT_SENDMAIL_PATH`
- `CONTACT_SENDMAIL_TIMEOUT_MS`
- `CONTACT_SMTP_HOST`
- `CONTACT_SMTP_PORT`
- `CONTACT_SMTP_SECURE`
- `CONTACT_SMTP_REQUIRE_TLS`
- `CONTACT_SMTP_TIMEOUT_MS`
- `CONTACT_SMTP_USER`
- `CONTACT_SMTP_PASS`

If a non-mock mode is enabled without the required public values and server secrets, startup fails with a clear error. In mock mode, the current production-safe mock behavior remains unchanged.

The public contact form now delivers through the server instead of only validating the payload. For production, prefer SMTP so the envelope sender is explicitly controlled by `CONTACT_FROM_EMAIL`; STARTTLS is required by default whenever implicit TLS is off, and authenticated cleartext SMTP is rejected. The current delivery target should remain `contacts@jacobdanderson.net`. To move later to an alias-based outbound pattern, set `CONTACT_FROM_EMAIL` to the sending alias, `CONTACT_TO_EMAIL` to the primary destination, and `CONTACT_BCC_EMAIL` to `contacts@jacobdanderson.net`. `CONTACT_USE_SENDMAIL=true` remains available as a local or fallback transport and requires an absolute executable path.

The same server mail transport now powers on-demand unread workspace digests from `/app/inbox`. Digest content is generated from the same inbox action queue that drives intros, unread conversations, proposals, signatures, and operational notices, and manual digest requests skip cleanly when the queue is clear. Scheduled digests are exposed through the worker-authenticated `/api/operations/notification-digests/run` endpoint and should be called by a server cron/timer with `COFOUNDRY_OPERATIONS_TOKEN`. Event-specific lifecycle notifications are exposed through `/api/operations/notifications/lifecycle` for `match.created`, `message.unread`, `proposal.updated`, `contract.signature_required`, `report.reviewed`, and `subscription.changed`. In mock/access-request mode, operations telemetry is persisted to `.data/operations-telemetry.json` by default, or to `COFOUNDRY_LOCAL_DATA_DIR` when set. Local mock-mode file uploads are stored under `.data/local-file-uploads/` by default and are exposed to scanner workers through worker-authenticated download URLs.

Agreement participants can negotiate from an accepted proposal into authoritative agreement versions, inspect field-level redlines, and collect version-specific signatures. When either participant has an active Pro or Team plan, that plan sponsors the shared agreement workflow so both participants can revise, request review, export, and sign that agreement without requiring two paid subscriptions. Sponsored agreements can invite a user-selected in-house or outside legal representative to one exact version through a confidential 14-day bearer link. The reviewer can approve the requested scope or request changes without receiving a member account; the response records a typed responder name and authority attestation but is not verified identity, licensure, engagement, or an electronic signature. Either agreement participant can revoke the link, and creating a revision supersedes earlier links. CoFoundry only transmits the version and response and does not select counsel or provide legal advice. When mail is unavailable, the requester receives the same link for manual delivery.

Team-plan sponsors can create organization workspaces at `/app/studio`. Each workspace has explicit owner, operator, member, reviewer, billing, and counsel roles; invitation and seat controls; venture and project tracking; durable decisions; shared founder searches; reusable agreement policies; version-bound internal approvals; linked relationship resources; an in-house legal-review queue; and organization audit history. Agreement policies can require internal approval and/or completed legal review before a linked agreement may be signed, restrict outside counsel, and require a different approver from the requester. Organization writes use optimistic version checks so stale browser state cannot silently overwrite newer decisions. Member reads are projected by role, and invitees see only their own pending invitation until they accept.

Public workspace access requests are durable in mock/access-request mode. `/auth/sign-up` submits access requests into `.data/access-requests.json` by default, admins can review them at `/admin/access-requests`, and issued invites create 30-day invite links that allow account creation without enabling public self-serve signup. Invited member workspace state is stored in `.data/member-workspace-state.json`, collaborative workflow state is stored in `.data/collaboration-state.json`, organization Team/Studio state is stored in `.data/organization-workspaces.json`, investment fundraising and review state is stored in `.data/investment-workspaces.json`, and legal-review requests and responses are stored separately in `.data/contract-legal-reviews.json`, so onboarding, profile edits, billing preview state, intros, messages, proposals, agreements, reviews, organization operations, fundraising planning, diligence, and inbox read state can survive process restarts before Supabase is enabled. Admin moderation decisions are stored in `.data/admin-audit.json`, including audit rows plus user/report/opportunity/notification overlays used by the mock-mode admin console. Privacy and trust-review requests submitted from account settings are stored in `.data/privacy-requests.json` and reviewed at `/admin/privacy`. Invited local accounts are stored in `.data/local-auth-accounts.json` so sign-in survives server restarts while the site remains in mock backend mode. When Supabase mode is intentionally enabled later, the same route surface writes to the relevant Supabase tables after the latest migrations are applied.

Public contact and access-request intake is also screened before mail delivery or durable queue writes. The shared intake policy keeps the existing honeypot and rate-limit behavior, then rejects high-confidence abuse such as reserved or disposable email domains, URL stuffing, repeated filler, test text, and obvious unrelated solicitations.

The canonical shared model and utility source lives under `front-end/shared`. Files under `front-end/src/shared` should stay as Nuxt alias shims unless a documented exception is needed. Run `npm run verify:shared-shims` after adding shared modules so server, Nuxt config, route handlers, pages, and tests keep using the same implementation.

## Local review accounts

- Founder review account: `olivia@cofoundry.dev` / `founder123`
- Collaborator review account: `malik@cofoundry.dev` / `builder123`
- Admin review account: `ava@cofoundry.dev` / `admin123`
- Investment reviewer account: `priya@cofoundry.dev` / `reviewer123` (requires `NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE="true"`)

Seeded review credentials are restricted to local development. Hosted environments reject the demo-access flag, and the credentials are not advertised as one-click shortcuts in the sign-in UI.

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
npm run a11y
npm run a11y:production
npm run verify:host-env -- --production
npm run verify:release:local
```

`npm run verify:release:local` is the full local release gate. It runs exact install, dependency audit, dependency install-script policy verification, standalone workspace install verification, Node/npm toolchain policy verification, synthetic production host-env verification, lint, typecheck, unit/backend tests, build, deployment identity, shared-shim, analytics, production smoke, local public crawl, accessibility, public-verification dispatch dry-run, live-deploy handoff prompt rendering, diagnostic syntax, and diff whitespace checks.

`npm run verify:install-scripts` checks npm's `allowScripts` review state. If a dependency adds or changes an install script, review the package and pin an approval or denial with `npm approve-scripts` or `npm deny-scripts` before shipping the dependency change.

`npm run verify:standalone-installs` checks the production-only backend install used by deployment (`npm ci --workspace back-end --omit=dev --dry-run`). The backend inherits the authoritative root lockfile, npm configuration, and `allowScripts` policy; the verifier rejects duplicate nested lock/config files, workspace-level `allowScripts` declarations that npm would ignore, and unreviewed install-script warnings before running a production-only backend audit at high severity or above.

`npm run verify:toolchain` checks that `packageManager`, `engines`, `.npmrc`, GitHub Actions, Netlify, and the direct systemd runtime stay on the reviewed Node 24.18.1/npm 12.0.2 baseline. Nested package scripts reuse the npm executable selected by the deployer instead of rediscovering the host's bundled npm, while installs remain protected by `engine-strict`. The verifier also rejects bootstrap-blocking root `devEngines`, obsolete inherited npm configuration, and reintroducing Docker or Compose as a deployment path.

### Direct production runtime

Production SSR runs directly with Node under `cofoundry-app.service`; Docker, Compose, Podman, and a container registry are not part of the supported topology. The checked-in files under `deploy/systemd/` install a hardened, unprivileged, loopback-only service and promote a prevalidated release atomically with automatic rollback when its health check fails. `deploy/nginx/cofoundry-proxy.conf.example` is an include for the existing TLS server block; it deliberately does not replace or remove the host's IPv4 or IPv6 listeners.

The public verifier also guards production-facing metadata and copy. Sitemap-listed public pages must render page-specific title, description, canonical, Open Graph, and Twitter metadata, and public pages plus linked noindex access pages fail verification if they expose mock/demo/sample/placeholder language that would make the live product feel unfinished.

After tagging or moving the current `v1.x` release, generate an exact server handoff prompt with `npm run server:prompt:live-deploy`. It fills in the release tag, commit SHA, deployment timestamp, and public origin for the safe mock/access-request deploy path.

`npm run verify:host-env -- --production` checks the current process environment without loading `.env` files or printing secret values. Use it on the host before restarting production to catch missing deployment identity, unsafe app URLs, demo-access drift, missing session signing secrets, and mode-specific secret requirements.

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
- The bundled demo workspace stays available only in local development
- Local development still supports cookie-backed mock auth, seeded workspace data, and preview billing flows
- Live accounts with `NUXT_PUBLIC_BILLING_MODE="mock"` use operator-managed billing instead of self-granting paid entitlements

Required env:

- `NUXT_PUBLIC_BACKEND_MODE="mock"`
- `NUXT_PUBLIC_BILLING_MODE="mock"`
- `NUXT_PUBLIC_ENABLE_DEMO_ACCESS="false"` for production-facing shells
- No server secrets are required

Hosted staging should use invited test accounts or a dedicated Supabase staging project; bundled demo credentials remain disabled outside local development.

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

`npm run seed` always writes `.data/mock-seed.json`. Remote Supabase writes require `SEED_SUPABASE_DATA=true` in addition to `NUXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; credentials alone never trigger remote writes. `SEED_SUPABASE_AUTH=true` additionally creates seeded review users, but only in local development.

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

- `NODE_ENV="production"`
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
- `COFOUNDRY_ADMIN_AUDIT_RETENTION_LIMIT`
- `COFOUNDRY_COLLABORATION_RETENTION_LIMIT`
- `COFOUNDRY_CONTRACT_LEGAL_REVIEW_RETENTION_LIMIT`
- `COFOUNDRY_PRIVACY_REQUEST_RETENTION_LIMIT`

Provisioning after merge:

1. Apply all SQL migrations in `back-end/supabase/migrations/` in timestamp order.
2. Run `npm run seed` against the target Supabase project.
3. Install or review `deploy/systemd/cofoundry-app.service`; it enforces `NODE_ENV=production`, a single process, and a loopback-only Nitro listener.
4. Configure `SESSION_SIGNING_SECRET` in the server environment or Vault injection.
5. Enable only the intended Supabase password/email account path first. Keep OAuth/external auth provider env markers blank until the provider app callback URLs, account linking, suspended-user rejection, role rehydration, and rollback have been smoke-tested. Provider sign-in buttons remain hidden unless Supabase mode and matching server-side OAuth markers are active.
6. Assign the first real admin user server-side before using `/admin`: `BOOTSTRAP_ADMIN_EMAIL=operator@example.com npm run -w back-end bootstrap-admin`. The script requires Supabase mode and the Vault-injected `SUPABASE_SERVICE_ROLE_KEY`; it updates an existing user row and records an admin action that `/admin/readiness` uses as first-admin bootstrap evidence.
7. Turn on Stripe env only when checkout and webhook infrastructure are ready.
8. Configure a distinct `COFOUNDRY_OPERATIONS_TOKEN` before starting any hosted deployment. It protects backend metadata and all scheduled digest, backup, event-ingestion, and file-scan worker calls. A non-loopback `BACKEND_HOST` is rejected unless the public-bind flag is explicit and this token is at least 32 characters.
9. In mock/access-request mode, ensure the app process can write to `.data/operations-telemetry.json`, `.data/access-requests.json`, `.data/member-workspace-state.json`, `.data/collaboration-state.json`, `.data/organization-workspaces.json`, `.data/investment-workspaces.json`, `.data/contract-legal-reviews.json`, `.data/admin-audit.json`, `.data/privacy-requests.json`, `.data/local-auth-accounts.json`, and `.data/local-file-uploads/`, or set `COFOUNDRY_LOCAL_DATA_DIR` to a durable writable host path.

## Production control surfaces

- Sensitive endpoints now have server-side rate limits for auth, contact, billing checkout, collaboration writes, member workspace writes, admin actions, inbox read transitions, data exports, and privacy requests.
- Nuxt responses include centralized security headers for sniffing protection, frame denial, strict referrer behavior, locked-down browser permissions, and production HTTPS HSTS when `NUXT_PUBLIC_APP_URL` is an HTTPS origin.
- Private workspace, admin, auth, onboarding, and sensitive API responses also emit `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow, noarchive` from server middleware so protected surfaces are not indexed or retained by shared caches.
- `/.well-known/security.txt` exposes a standards-friendly security contact, canonical URL, expiration, and policy link using the configured support email and public app URL.
- `/api/health` exposes a no-store, secret-free liveness response for uptime checks and load balancer probes. Host-provided `COFOUNDRY_RELEASE`, `COFOUNDRY_COMMIT_SHA`, and `COFOUNDRY_DEPLOYED_AT` remain authoritative, but the Nuxt build bakes in the current Git commit as a fallback so public verification can still identify the deployed code when systemd omits `COFOUNDRY_COMMIT_SHA`.
- Scheduled unread workspace digest emails respect each member's account-level email notification preference; seeded review users remain enabled, while newly persisted Supabase users default to disabled until they opt in.
- Member workspace changes, collaboration workflow updates, and billing preview state persist in Supabase mode and in durable local mock-mode stores.
- Relationship workspaces support first-class decision notes before or alongside proposals, and those notes persist in durable mock mode and the future Supabase `relationship_decisions` table.
- Team and Studio workspaces use a server-owned aggregate with optimistic concurrency, role-scoped projections, durable mock persistence, and a service-role-only Supabase table. Organization agreement policies are enforced again at contract-signing time so a client-side bypass cannot skip a required approval or legal review.
- Signed sessions are revalidated against persisted user state on every protected request. Role changes take effect without requiring a new login, and suspended users are rejected in both durable mock/access-request mode and Supabase-backed mode. Missing workspace/subscription rows fail closed to a free member baseline rather than rebuilding privileges from stale cookie claims.
- Seeded review account credentials are accepted only in local development. Hosted mock/access-request deployments can still sign in invited durable local accounts, but they never accept bundled demo credentials.
- Admin moderation actions persist user suspension, role changes, report status changes, opportunity verification decisions, notifications, queue assignment/routing metadata, and audit actions in Supabase mode and in the durable local mock-mode admin audit store.
- Admins can mark member emails verified from `/admin/users` after invite, domain, or operator evidence review; the decision is persisted and auditable in mock/access-request mode and Supabase mode.
- Access-request review has a mock-mode admin queue at `/admin/access-requests` and a Supabase-backed table path for later. Operators can approve, deny, reopen, and issue invite links while Supabase and Stripe remain disabled. Intake is serialized by normalized email, so simultaneous duplicate submissions reuse the existing active request and do not resend operator mail.
- `/auth/recover` gives invited or existing members an intentional account-help path. It files a durable `auth-recovery` row into the access-request queue and sends the normal access-request notification when mail is configured; it does not expose automated password-reset tokens before the live auth/mail provider path is intentionally provisioned.
- Account settings include a JSON data export, privacy-request submission, and trust-verification review requests. The export includes the member's applicant-projected investment workspaces and privacy/trust requests without exposing staff review notes, internal decision rationale, partner-preparation notes, internal operator notes, or administrator identifiers. The settings UI no longer self-awards trust badges.
- Account exports include version-bound legal-review requests and responses for agreements in which the member participates. Reviewer links and signing material are never exported.
- New startup opportunity posts cannot self-award owner or domain verification. Claimed proof methods put the listing under manual review until an operator or verification provider confirms the signal.
- Admins can review privacy and trust-review requests at `/admin/privacy` from Supabase mode or the local mock-mode queue. A request can be marked reviewed with a handling note, but it can be marked resolved only after the operator explicitly confirms that the requested export, deletion, correction, visibility, or safety action was actually completed or documented outside CoFoundry. Both transitions create audit actions and user notifications.
- Admins can assign queue cases to another admin, route escalations to the right operator lane, review trust-evidence packages, and resolve opportunity ownership/domain verification reviews from `/admin/queue` and `/admin/evidence`; these decisions are backed by `admin_actions.metadata` plus the audit log. The admin queue reads opportunity listings through an admin-only endpoint that includes seeded listings plus persisted member listings from durable local mock mode or Supabase mode.
- Admins can review `/admin/readiness` for a server-derived launch-readiness view covering environment, session secrets, admin access/bootstrap evidence, mail, local persistence, access/privacy queues, backups, restore-drill evidence, scanner status, digest worker evidence, email-suppression provider evidence when configured, contract-envelope provider evidence when configured, monitoring heartbeats, and operational events. The same view exposes a copyable provisioning checklist for host-level secrets, local durable storage, mail, worker timers, restore drills, monitoring, first-admin bootstrap, and future Stripe cutover.
- Supabase migrations include RLS policies for user-owned, participant-owned, admin-only, notification, privacy, file-upload, backup, and operational tables.
- File uploads are represented by server-owned metadata. Supabase mode uses signed Supabase upload/download URLs against the private `cofoundry-private-files` bucket. Mock/access-request mode uses tokenized local upload URLs and stores content under the durable local data directory so a scanner worker can download files through worker-authenticated app URLs.
- Relationship workspaces now have a server read endpoint and `/app/relationships/:id` page that aggregates conversation, trial, proposal, agreement, unread, and next-action state.

Worker-authenticated operations endpoints:

- `POST /api/operations/notification-digests/run` sends unread workspace digests across Supabase users who have enabled scheduled digest email. It accepts `{ "dryRun": true, "maxUsers": 100, "onlyWithUnread": true }` for safe verification.
- `POST /api/operations/notifications/lifecycle` renders and records event-specific lifecycle notifications. It accepts `{ "dryRun": true, "eventType": "proposal.updated", "userId": "user_malik", "targetType": "proposal", "targetId": "proposal_ledgerloop_cto" }`. Mock/access-request mode records the attempt without sending mail.
- `POST /api/operations/backup-runs` records backup job lifecycle events in `backup_runs`.
- `POST /api/operations/events` records deploy, worker, scanner, backup, and monitoring events in `operational_events`.
- `GET /api/operations/file-scans/pending?limit=25` returns pending upload metadata with scanner download URLs. Supabase mode returns short-lived signed storage URLs; mock/access-request mode returns worker-authenticated app URLs when local content has been uploaded.
- `POST /api/operations/file-scans/:id` records malware/content scan results for uploaded files.

Each endpoint requires `Authorization: Bearer <COFOUNDRY_OPERATIONS_TOKEN>` or `x-cofoundry-operations-token`. Hosted startup now requires this token, while tokenless local development remains available; the endpoints fail closed whenever a strong token is absent.

Checked-in worker commands wrap those endpoints for systemd timers or cron:

- `sudo deploy/systemd/install-operations-units.sh --dry-run` previews the checked-in operations unit install; `sudo deploy/systemd/install-operations-units.sh` installs the default heartbeat, digest, scan, and backup timers while keeping restore-drill opt-in until a manual restore check succeeds.
- `npm run operations:backup -- --provider server-backup --artifact-uri <artifact-uri> -- <backup command>` records backup start and final success/failure around the real host backup command.
- `npm run operations:digest -- --dry-run --max-users 100` verifies scheduled digest delivery before removing `--dry-run`.
- `COFOUNDRY_FILE_SCANNER_COMMAND="clamscan --no-summary" npm run operations:scan -- --limit 25` polls pending file scans, downloads private uploads, runs the scanner, and reports `clean`, `flagged`, or `failed`.
- `npm run operations:heartbeat -- --metadata schedule=hourly` records the canonical `monitoring.heartbeat` row expected by `/admin/readiness`.
- `npm run operations:alert-smoke -- --metadata runbook=manual` records and, when `COFOUNDRY_ALERT_WEBHOOK_URL` is configured, delivers the canonical `monitoring.alert_test` row expected by `/admin/readiness`.
- `npm run operations:event -- --source systemd --event-type deploy.completed --metadata release=v1.x` records deploy, monitor, backup, and worker events. Report a recent `monitoring.heartbeat` or equivalent monitor/alert event so `/admin/readiness` can prove monitoring is wired.
- `npm run operations:restore-drill -- --id restore-YYYYMMDD -- <restore verification command>` records restore-drill start and success/failure events.

When Supabase is disabled, these endpoints write durable local telemetry rows to `operations-telemetry.json` with a default retention limit of 200 rows per collection. Local upload content is stored under `local-file-uploads/` in the same data directory and is not committed to source. Set `COFOUNDRY_OPERATIONS_RETENTION_LIMIT` to tune telemetry retention.

Access-request rows are separately retained in `access-requests.json` with a default limit of 500. Collaboration workflow rows are retained in `collaboration-state.json` with a default per-collection limit of 1000. Team/Studio and investment aggregates use their own versioned local documents. Version-bound legal-review rows are retained in `contract-legal-reviews.json` with a default limit of 5000. Admin audit rows and moderation overlays are retained in `admin-audit.json` with a default limit of 500. Privacy and trust-review requests are retained in `privacy-requests.json` with a default limit of 500. Set `COFOUNDRY_ACCESS_REQUEST_RETENTION_LIMIT`, `COFOUNDRY_COLLABORATION_RETENTION_LIMIT`, `COFOUNDRY_CONTRACT_LEGAL_REVIEW_RETENTION_LIMIT`, `COFOUNDRY_ADMIN_AUDIT_RETENTION_LIMIT`, and `COFOUNDRY_PRIVACY_REQUEST_RETENTION_LIMIT` to tune those queues, and keep `COFOUNDRY_LOCAL_DATA_DIR` on durable host storage if invite-only mock-mode accounts need to survive deployment restarts.

The server-side handoff prompt for wiring these jobs lives at `docs/server-ai-operations-prompt.md`; first-admin provisioning is covered in `docs/server-ai-admin-bootstrap-prompt.md`; live deploy catch-up is covered in `docs/server-ai-live-deploy-prompt.md` and can be rendered with exact release values through `npm run server:prompt:live-deploy`; the staged provider cutover prompt lives at `docs/server-ai-production-cutover-prompt.md`; the recurring operator checklist lives at `docs/operations-runbook.md`.

## Billing notes

The frontend checkout route lives at `front-end/server/api/billing/checkout.post.ts`.

- In local or deliberate staging demo mode, mock billing can update a workspace plan preview without contacting Stripe
- In live account mode with `NUXT_PUBLIC_BILLING_MODE="mock"`, paid-plan changes route to the team and do not mutate entitlements
- In Stripe mode it creates a Stripe Checkout Session using env-driven price IDs
- `/api/billing/webhook` verifies Stripe signatures, records non-secret webhook processing telemetry, and syncs checkout/subscription updates into the Supabase subscription row
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
5. Trigger a checkout or subscription webhook and confirm `/admin/operations` shows `stripe.webhook.processed`; `/admin/readiness` warns in Stripe mode until that evidence exists.

## Production secret model

Current deployments can stay in mock mode with no secret-backed services enabled.

- Public env can live in normal env files or deploy-time public environment settings.
- Server-only secrets are expected to come from Vault-managed env files or equivalent host injection later.
- Local development generates process-random fallback keys for sessions and email-preference links. Those keys intentionally do not survive a restart; every hosted or durable environment must inject `SESSION_SIGNING_SECRET`.
- Build stages use non-production sentinel values only to compile the SSR bundle. `npm run build` scans the output and fails if a server-only secret name or sentinel value is embedded.
- The repo is already wired so that moving from mock mode to Supabase or Stripe is a config change, not another refactor.
- Production app processes should set `NODE_ENV=production`. If `NODE_ENV` is omitted, a non-local `NUXT_PUBLIC_APP_URL` is still treated as hosted rather than local development for account access policy, secure session/OAuth cookies, and production security headers.
- Deployment identity values are non-secret. Prefer setting `COFOUNDRY_RELEASE`, `COFOUNDRY_COMMIT_SHA`, and `COFOUNDRY_DEPLOYED_AT` from the deploy pipeline or host unit env; if `COFOUNDRY_COMMIT_SHA` is missing, the frontend falls back to the Git commit captured during `nuxt build`.
- `NUXT_PUBLIC_APP_URL` falls back to `http://localhost:3000` only for local development. Production SSR avoids localhost-style defaults, derives the public request origin when proxy headers provide one, and otherwise uses CoFoundry's canonical production origin as a last-resort safety net so public metadata, robots, sitemap, and security.txt do not expose localhost. `/admin/readiness` still fails hosted deployments until `NUXT_PUBLIC_APP_URL` is explicitly set.
- `COFOUNDRY_ALLOW_LOCAL_PUBLIC_APP_URL=true` is reserved for the checked-in local production-smoke harness. Do not set it on hosted production.
- HSTS is intentionally tied to a hosted HTTPS `NUXT_PUBLIC_APP_URL`, so local preview and non-HTTPS development hosts do not receive a misleading transport-security header.
- If `NUXT_PUBLIC_BACKEND_MODE="mock"` in a production deployment, the product should stay in marketing-shell mode unless `NUXT_PUBLIC_ENABLE_DEMO_ACCESS="true"` is set deliberately for a staging/demo environment.
- `SESSION_SIGNING_SECRET`, `COFOUNDRY_OPERATIONS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` should stay externalized through Vault-managed or host-managed secret injection, not committed env files.
- Backup and observability migrations create `backup_runs` and `operational_events` tables. Source routes now accept worker reports and persist them locally in mock mode. `/admin/readiness` now warns until both a restore-drill success and a monitoring/alerting heartbeat have been reported, but the actual backup schedule, restore drill command, log drain, and alerting provider are still server/operator provisioning tasks.

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
- Mock billing mutations appear only in local development or deliberate staging demo access. Live accounts without Stripe use operator-managed billing.
- `/app/investment`, `/app/investment/:id`, and the isolated `/investment-review` console remain feature-flagged behind `NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE`.
- `/app/studio` and `/app/studio/:id` are Team-plan organization surfaces; creation and operational writes require a current Team sponsor, while an invited member can still accept or decline their own invitation.

## Feature-flagged fundraising and investment review

Applicant routes live under `front-end/src/pages/app/investment`; staff routes live under the separate `front-end/src/pages/investment-review` layout and middleware boundary.

- Disabled by default with `NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE="false"`
- Hosted enablement fails closed unless Supabase persistence is active, `COFOUNDRY_INVESTMENT_PROGRAM_APPROVED="true"`, and `COFOUNDRY_FILE_SCANNER_COMMAND` is configured. Local development remains available for isolated workflow review without those production markers.
- When enabled, founders can maintain readiness, rounds, a private applicant-owned prospect pipeline, interactions, secure data-room records, founder updates, and a supplemental-terms-backed program application.
- Program staff receive the application, readiness, and round snapshot captured for the latest submitted revision plus records explicitly shared with the program. Later application drafts and private planning changes do not alter that snapshot. Applicant prospect and interaction records are excluded from staff projections; staff-only notes and internal rationale are excluded from applicant responses and exports.
- Reviewers can assign cases, request information, open diligence, record internal and applicant-facing decisions, and prepare a regulated-partner handoff only after separate applicant consent.
- CoFoundry does not discover or recommend investors, handle funds or securities, execute securities transactions, or receive transaction-based compensation. Program acceptance is not a financing commitment, and any offering or transaction proceeds outside CoFoundry through counsel and registered intermediaries when required.
- The workflow does not implement cap-table management and does not force platform equity.

## Tests

Coverage includes:

- utility tests for discovery filtering and contract generation
- component tests for reusable UI primitives
- organization and investment transition, projection, permissions, concurrency, local persistence, legal-review queue, consent, privacy-boundary, and migration tests

Run:

```bash
npm run test:run
```

## Structure

Key areas:

- `front-end/src/pages`: marketing, auth, app, and admin routes
- `front-end/src/stores`: auth, workspace, organization, and toast state
- `front-end/shared`: typed domain model, marketing content, seed data, and shared utilities
- `front-end/server`: auth, contact, and billing routes
- `back-end/scripts/seed.ts`: seed snapshot plus optional Supabase seeding
- `back-end/supabase/migrations`: SQL schema and migrations

## Notes

- Contract templates include a clear legal-review disclaimer and are not legal advice
- Direct contact is hidden until a connection is mutual
- The app shell supports dark and light mode
- Mock mode is the primary local-development path
