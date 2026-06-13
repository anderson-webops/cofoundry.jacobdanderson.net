# CoFoundry Operations Runbook

CoFoundry can run in production-facing mock/access-request mode today without Supabase or Stripe. Treat this runbook as the server-side checklist for the pieces that need durable host setup before switching on live persistence, billing, or background workers.

## Required Host State

- `NUXT_PUBLIC_BACKEND_MODE=mock` and `NUXT_PUBLIC_BILLING_MODE=mock` remain the safe production defaults until Supabase and Stripe are deliberately enabled.
- `SESSION_SIGNING_SECRET` should be injected from the host secret store even in mock mode so invited-account sessions survive deploys.
- `COFOUNDRY_LOCAL_DATA_DIR` should point at a durable, backed-up directory for member workspace state, collaboration workflow state, access requests, admin audit overlays, privacy/trust review requests, invited local accounts, operations telemetry, and local mock-mode file scan artifacts.
- `COFOUNDRY_OPERATIONS_TOKEN` should be a long random secret before any `/api/operations/*` worker is scheduled.

## Daily Checks

- Visit `/admin/readiness` and resolve any fail or warning checks before treating the deployment as production-ready.
- Confirm `/api/health` returns `status: "ok"` from the deployed Nuxt app.
- Visit `/admin/operations` and confirm the newest backup, scanner, digest, and operational-event rows are current.
- Visit `/admin/audit` and confirm recent moderation, role, report, and privacy-request actions are present after reloads.
- Visit `/admin/users` and confirm pending emails can be marked verified only after invite, domain, or operator evidence review.
- Sign in to an invited test account and confirm profile, inbox, and billing preview changes survive an app restart.
- Visit `/admin/access-requests` and clear stale access requests or invite links.
- Visit `/admin/privacy` and resolve open privacy or trust-review requests with an operator note.
- Visit `/admin/queue` and confirm critical cases have an owner and an escalation route when they need cross-admin follow-up.
- Visit `/admin/evidence` and confirm trust-evidence uploads are scanned, reviewed, and visible in `/admin/audit`.
- Confirm the contact/support inbox is receiving submissions.
- Confirm a public page response includes `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and, on HTTPS production origins, `Strict-Transport-Security`.
- Confirm `/.well-known/security.txt` points to a monitored security/support inbox and the current HTTPS production origin.

## Worker Schedule

Checked-in systemd templates live in `deploy/systemd/`. Use them as the default host implementation, then tune `User=`, `Group=`, `WorkingDirectory=`, calendar intervals, and host wrapper scripts for the actual server.

- Backup runner: wrap the real host backup command with `npm run operations:backup -- --provider server-backup --artifact-uri <artifact-uri> -- <backup command>`. The worker records `running`, then `succeeded` or `failed`, through `POST /api/operations/backup-runs`.
- Notification digest runner: call `npm run operations:digest -- --dry-run --max-users 100` before enabling real sends. Remove `--dry-run` only after SMTP and member notification preferences are verified. Scheduled digest runs skip members whose `/app/settings` email-notification preference is disabled; Supabase users default to disabled until they opt in.
- File scanner: configure `COFOUNDRY_FILE_SCANNER_COMMAND` or pass `--scanner-command`. Run `npm run operations:scan -- --limit 25` to poll pending scans, download private files, run the scanner, and report `clean`, `flagged`, or `failed` through `POST /api/operations/file-scans/:id`. Supabase mode returns short-lived storage URLs; mock/access-request mode returns worker-authenticated app download URLs.
- Monitor runner: report deploy, worker, scanner, backup, and monitoring events with `npm run operations:event -- --source systemd --event-type deploy.completed --metadata release=v1.x`.
- Restore drill runner: wrap a staging restore verification command with `npm run operations:restore-drill -- --id restore-YYYYMMDD -- <restore verification command>`.

Each worker call must send `Authorization: Bearer <COFOUNDRY_OPERATIONS_TOKEN>` or `x-cofoundry-operations-token`.

## Restore Drill

1. Snapshot the durable local data directory or Supabase project before a deploy.
2. Restore into a staging host or staging Supabase project.
3. Confirm `/admin/operations`, `/admin/audit`, `/admin/access-requests`, `/admin/privacy`, `/app/inbox`, `/app/billing`, and `/app/settings` load from restored data.
4. Record the drill with `npm run operations:restore-drill -- --id restore-YYYYMMDD -- <restore verification command>` so the start and success/failure events appear in `/admin/operations`.

## Supabase Cutover

1. Apply all SQL migrations in `back-end/supabase/migrations/` in timestamp order.
2. Seed baseline rows with `npm run seed` only against the intended target project.
3. Create the first user through the normal account path.
4. Run `BOOTSTRAP_ADMIN_EMAIL=operator@example.com npm run -w back-end bootstrap-admin` from the server environment with Vault-injected Supabase secrets.
5. Verify the corresponding `users` row exists, is not suspended, and has the expected role. CoFoundry signed sessions are accepted only when they map to an active persisted user row.
6. Verify the user can access `/admin`, `/admin/users`, `/admin/audit`, `/admin/operations`, `/admin/access-requests`, `/admin/privacy`, `/admin/queue`, and `/admin/evidence`.
7. Only then set `NUXT_PUBLIC_BACKEND_MODE=supabase`.

## Stripe Cutover

- Keep `NUXT_PUBLIC_BILLING_MODE=mock` until checkout, customer portal, webhook signature validation, and subscription reconciliation have been tested against a staging Stripe account.
- Enable Stripe only after the webhook endpoint is registered and `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, public price IDs, and the publishable key are present in the host secret/public env model.
