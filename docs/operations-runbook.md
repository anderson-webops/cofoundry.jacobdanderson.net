# CoFoundry Operations Runbook

CoFoundry can run in production-facing mock/access-request mode today without Supabase or Stripe. Treat this runbook as the server-side checklist for the pieces that need durable host setup before switching on live persistence, billing, or background workers.

For a paste-ready staged handoff that covers the remaining external providers, use `docs/server-ai-production-cutover-prompt.md`.

## Required Host State

- `NUXT_PUBLIC_BACKEND_MODE=mock` and `NUXT_PUBLIC_BILLING_MODE=mock` remain the safe production defaults until Supabase and Stripe are deliberately enabled.
- `NUXT_PUBLIC_APP_URL` should be set to the deployed HTTPS origin. A non-local value is treated as hosted even if `NODE_ENV` is accidentally omitted, so account access policy, secure session/OAuth cookies, and production security headers do not drift into local-development behavior. Server-rendered public URLs have a last-resort production fallback to prevent localhost leaks in robots, sitemap, security.txt, and page metadata, but `/admin/readiness` still fails hosted deployments until the explicit public URL is configured. `COFOUNDRY_ALLOW_LOCAL_PUBLIC_APP_URL=true` is only for local production-smoke verification.
- `COFOUNDRY_RELEASE`, `COFOUNDRY_COMMIT_SHA`, and `COFOUNDRY_DEPLOYED_AT` are non-secret deployment identity values. Set release and deploy time from the deploy pipeline or host unit env when available. The Nuxt build also bakes in the current Git commit as a safe fallback, so `/api/health` and `/admin/readiness` can still prove what code is running if the host accidentally omits `COFOUNDRY_COMMIT_SHA`.
- `SESSION_SIGNING_SECRET` should be injected from the host secret store even in mock mode so invited-account sessions survive deploys.
- `COFOUNDRY_LOCAL_DATA_DIR` should point at a durable, backed-up directory for member workspace state, collaboration workflow state, access requests, admin audit overlays, privacy/trust review requests, invited local accounts, operations telemetry, and local mock-mode file scan artifacts.
- `COFOUNDRY_OPERATIONS_TOKEN` should be a long random secret before any `/api/operations/*` worker is scheduled.
- `COFOUNDRY_REALTIME_FANOUT_URL` should stay unset while the production app runs as one Node process. If the host runs multiple app instances, set `COFOUNDRY_EXPECT_MULTI_INSTANCE=true`, configure an internal relay URL, and have that relay POST signed envelopes to `/api/operations/realtime-events` on every instance with `COFOUNDRY_OPERATIONS_TOKEN`.
- `COFOUNDRY_ALERT_WEBHOOK_URL` is optional and should stay unset until an operator chooses the alerting destination. When set, operation workers post non-blocking JSON alerts for `error` and `warning` events by default. Use `COFOUNDRY_ALERT_WEBHOOK_TOKEN`, `COFOUNDRY_ALERT_SEVERITIES`, and `COFOUNDRY_ALERT_TIMEOUT_MS` only from server-side env.
- `COFOUNDRY_EMAIL_SUPPRESSION_PROVIDER` is optional and should stay unset until the outbound mail provider's bounce, complaint, unsubscribe, and manual-suppression events are mapped into CoFoundry. When set, `/admin/readiness` expects recent suppression evidence reported through the worker-authenticated endpoint.
- `COFOUNDRY_OAUTH_PROVIDER`, `COFOUNDRY_GOOGLE_OAUTH_PROVIDER`, and `COFOUNDRY_GITHUB_OAUTH_PROVIDER` should stay unset until Supabase mode, provider app callback URLs, account linking, suspended-user rejection, session rehydration, and rollback are smoke-tested. Provider buttons on `/auth/sign-in` stay hidden unless Supabase mode and matching server-side OAuth markers are active; if any marker is set before smoke evidence exists, `/admin/readiness` intentionally warns instead of implying provider auth is live.
- `COFOUNDRY_TRUST_VERIFICATION_PROVIDER` is optional and should stay unset until an identity, phone, social/OAuth, work-domain, or opportunity-ownership provider is selected. When set, `/admin/readiness` expects recent trust-verification evidence reported through the worker-authenticated endpoint.
- `COFOUNDRY_CONTRACT_ENVELOPE_PROVIDER` is optional and should stay unset unless a dedicated e-signature/PDF provider is selected. When set, `/admin/readiness` expects recent completed envelope evidence reported through the worker-authenticated endpoint.

## Daily Checks

- Visit `/admin/readiness` and resolve any fail or warning checks before treating the deployment as production-ready.
- Use `/admin/readiness`'s production cutover phases as the quick-read for which provider stages are active, intentionally disabled, blocked, or complete.
- Use `/admin/readiness`'s server provisioning checklist as the canonical handoff for host-level secrets, durable storage, mail, worker timers, restore drills, monitoring, first-admin bootstrap, and Stripe cutover preparation.
- After every release build, run `npm run audit`, `npm run verify:analytics`, `npm run verify:deployment-identity`, `npm run verify:production`, `npm run verify:public:local`, and `npm run a11y:production` from the checked-out source. The audit command checks workspace dependency advisories. The analytics verifier checks that the production analytics trackers are present in the built Nuxt output. The deployment-identity verifier starts the built Nitro server with release/commit env stripped and confirms `/api/health` still exposes the baked Git commit fallback. The production verifier starts the built Nitro server in mock/access-request mode and verifies health/deployment identity, health HEAD behavior, production security headers including HSTS, no localhost leaks in public metadata, canonical robots/sitemap/security.txt URLs, unknown-route 404s, admin access control, private-surface no-store/noindex response policy, workspace realtime endpoints failing closed without a session, operations realtime fanout ingress failing closed without a worker token, authenticated readiness metadata, public-form honeypot handling, intake-quality rejection, and contact-mail graceful degradation. The local public verifier starts the same built server, reads `sitemap.xml` as the canonical public route inventory, crawls every listed public page, and verifies SEO, internal public-link integrity, private-route redirects, private-surface no-store/noindex response policy, robots, sitemap, and security.txt behavior before deploy. The production accessibility verifier runs axe checks against the built public shell in light and dark mode.
- After every deploy, run `VERIFY_PUBLIC_EXPECT_RELEASE=<release> VERIFY_PUBLIC_EXPECT_COMMIT_SHA=<commit> npm run verify:public` from the checked-out source, or set `VERIFY_PUBLIC_BASE_URL=https://your-host.example` for another target. It verifies sitemap-listed public routes, same-origin public links, security headers, health mode, deployment identity, private-route access control, noindex behavior, `robots.txt`, `sitemap.xml`, and `/.well-known/security.txt` against the deployed origin. If the host only exposes one identity field, set that one or use `VERIFY_PUBLIC_REQUIRE_DEPLOYMENT_IDENTITY=true` to require at least release or commit. If the verifier reports local URLs in public output, treat the deployed server as stale or missing `NUXT_PUBLIC_APP_URL`; deploy the validated release, restart the service, and confirm the host env sets the canonical HTTPS origin.
- When a deploy finishes, also trigger the checked-in GitHub workflow so the live-origin result is visible outside the server shell. Prefer the checked-in dispatcher when `GITHUB_TOKEN` or `GH_TOKEN` is available: `npm run verify:public:dispatch -- --expected-release <release> --expected-commit-sha <commit>`. You can preview the payload with `npm run verify:public:dispatch -- --dry-run --expected-release <release> --expected-commit-sha <commit>`. If the GitHub CLI is already installed, the equivalent manual trigger is `gh workflow run public-site-verification.yml -R anderson-webops/cofoundry.jacobdanderson.net -f base_url=https://cofoundry.jacobdanderson.net -f expected_release=<release> -f expected_commit_sha=<commit> -f require_deployment_identity=true`.
- Confirm `/api/health` returns `status: "ok"` from the deployed Nuxt app.
- Confirm `/api/health` and `/admin/readiness` show the expected release tag or commit SHA after each deploy. If host env omits `COFOUNDRY_COMMIT_SHA`, the value should still fall back to the commit baked into the Nuxt build.
- Visit `/admin/operations` and confirm the newest backup, scanner, digest, trust-verification, and operational-event rows are current.
- Confirm `/admin/readiness` shows recent restore-drill evidence. A backup without a successful restore drill remains a warning.
- Confirm `/admin/readiness` shows a recent monitoring or alerting heartbeat event. Prefer the canonical `npm run operations:heartbeat -- --metadata schedule=hourly`, which records `monitoring.heartbeat`; equivalent monitor/alert events reported through `npm run operations:event` also work.
- If `COFOUNDRY_ALERT_WEBHOOK_URL` is configured, confirm `/admin/readiness` shows a recent alert-smoke event. Use `systemctl start cofoundry-operations-alert-smoke.service` after changing the alert destination, or run `npm run operations:alert-smoke -- --metadata runbook=manual` directly before the unit templates are installed.
- If contact or digest mail is configured, confirm `/admin/readiness` shows a recent successful mail-smoke delivery. Use `systemctl start cofoundry-operations-mail-smoke.service` after changing SMTP/sendmail settings, or run `npm run operations:mail-smoke -- --to-email <monitored-inbox>` directly before the unit templates are installed.
- If `COFOUNDRY_REALTIME_FANOUT_URL` is configured or `COFOUNDRY_EXPECT_MULTI_INSTANCE=true`, confirm `/admin/readiness` shows recent realtime fanout smoke evidence. Use `systemctl start cofoundry-operations-realtime-smoke.service` after relay or instance changes, or run `npm run operations:realtime-smoke -- --min-delivered 0` directly before the unit template is installed. Set `--min-delivered 1` or higher only when a member SSE stream is intentionally connected on another app instance.
- If `COFOUNDRY_EMAIL_SUPPRESSION_PROVIDER` or another suppression-provider marker is configured, confirm `/admin/readiness` shows recent email-suppression evidence and `/admin/operations` shows the matching suppression row.
- If any OAuth-provider marker is configured, confirm `/admin/readiness` shows recent `auth.oauth.signed_in` telemetry from a successful staging/provider callback before exposing provider sign-in publicly.
- If `COFOUNDRY_CONTRACT_ENVELOPE_PROVIDER` or another contract-provider marker is configured, confirm `/admin/readiness` shows recent contract-envelope evidence and `/admin/operations` shows the matching completed envelope row.
- If `COFOUNDRY_TRUST_VERIFICATION_PROVIDER` or another trust-provider marker is configured, confirm `/admin/readiness` shows recent trust-verification evidence and `/admin/operations` shows the matching provider row.
- If `NUXT_PUBLIC_BILLING_MODE=stripe` is deliberately enabled, confirm `/admin/readiness` shows recent Stripe webhook evidence and `/admin/operations` shows a matching `stripe.webhook.processed` row.
- Visit `/admin/audit` and confirm recent moderation, role, report, and privacy-request actions are present after reloads.
- Visit `/admin/users` and confirm pending emails can be marked verified only after invite, domain, or operator evidence review.
- Sign in to an invited test account and confirm profile, inbox, and billing preview changes survive an app restart.
- Visit `/admin/access-requests` and clear stale access requests or invite links.
- Visit `/admin/privacy` and resolve open privacy or trust-review requests with an operator note.
- Visit `/admin/queue` and confirm critical cases have an owner and an escalation route when they need cross-admin follow-up. Resolve startup opportunity ownership/domain verification reviews from this queue instead of granting listing badges from member-facing screens. Confirm newly invited members' persisted startup listings appear here when they request domain or ownership verification.
- Visit `/admin/evidence` and confirm trust-evidence uploads are scanned, reviewed, and visible in `/admin/audit`.
- Confirm the contact/support inbox is receiving submissions.
- Confirm a public page response includes `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and, on HTTPS production origins, `Strict-Transport-Security`.
- Confirm `/.well-known/security.txt` points to a monitored security/support inbox and the current HTTPS production origin.

## Worker Schedule

Checked-in systemd templates and a dry-run capable installer live in `deploy/systemd/`. Use them as the default host implementation, then tune `User=`, `Group=`, `WorkingDirectory=`, calendar intervals, and host wrapper scripts for the actual server.

Preview and install the default timer set from the deployed checkout:

```sh
sudo deploy/systemd/install-operations-units.sh --dry-run
sudo deploy/systemd/install-operations-units.sh
```

The installer enables heartbeat, digest, scan, and backup timers by default. It creates `/etc/cofoundry/operations.env` only when missing, does not overwrite it unless `--force-env` is passed, and leaves the restore-drill timer disabled unless `--enable-restore-drill` is passed after a manual restore check succeeds.

- Backup runner: wrap the real host backup command with `npm run operations:backup -- --provider server-backup --artifact-uri <artifact-uri> -- <backup command>`. The worker records `running`, then `succeeded` or `failed`, through `POST /api/operations/backup-runs`.
- Notification digest runner: call `npm run operations:digest -- --dry-run --max-users 100` before enabling real sends. Remove `--dry-run` only after SMTP and member notification preferences are verified. Digest content follows the same inbox action queue used by `/app/inbox`, includes a signed preference-management footer, and sends a `List-Unsubscribe` header. Intros, unread conversations, proposals, signatures, and operational notices are handled consistently. Scheduled digest runs skip members whose `/app/settings` digest preference is disabled; Supabase users default to disabled until they opt in.
- Mail smoke runner: after configuring `CONTACT_*` SMTP or sendmail env and `COFOUNDRY_MAIL_SMOKE_TO_EMAIL`, run `systemctl start cofoundry-operations-mail-smoke.service` from the server. Before systemd templates are installed, call `npm run operations:mail-smoke -- --to-email <monitored-inbox>` directly. The endpoint sends a controlled smoke message and records `mail.smoke` delivery telemetry for `/admin/operations` and `/admin/readiness`.
- Lifecycle notification runner: call `npm run operations:worker -- lifecycle-notification --dry-run --event-type proposal.received --target-type proposal --target-id <proposal-id> --user-id <recipient-user-id>` to verify event-specific notification rendering and delivery telemetry before enabling real sends. Mock/access-request mode records the row without sending mail; Supabase mode can send after SMTP and event triggers are configured. Source-triggered events cover intro received/accepted, unread messages, proposals received/updated, signature requests, report reviews, and billing state changes. Optional relationship workflow events include a signed preference-management footer plus `List-Unsubscribe` header and are skipped unless the member enables workflow email in `/app/settings`; billing and safety notices are handled separately.
- Email suppression reporter: map provider unsubscribe, bounce, complaint, and manual suppression events to `npm run operations:worker -- email-suppression --email <recipient> --reason complaint --category all --provider <provider> --source-event-id <event-id>`. Suppression rows appear in `/admin/operations`; optional digest and workflow emails skip matching recipients before live send attempts.
- Contract envelope reporter: if a dedicated e-signature or PDF provider is selected, map provider envelope events to `npm run operations:worker -- contract-envelope --contract-id <contract-id> --contract-version-id <version-id> --provider-envelope-id <envelope-id> --status completed --provider <provider>`. Completed PDF file IDs, PDF SHA-256 hashes, and provider-reported signer IDs appear in `/admin/operations` and in agreement certificate downloads for the matching contract version.
- Trust verification reporter: if phone, social/OAuth, work-domain, identity, or opportunity-ownership providers are selected, map provider results to `npm run operations:trust-verification -- --target-type profile --target-id <profile-id> --verification-type government_id --status verified --provider <provider> --source-event-id <event-id>`. These rows appear in `/admin/operations` as evidence for operator policy and review; do not treat provider callbacks as automatic badge grants unless a later source change deliberately wires that policy.
- File scanner: configure `COFOUNDRY_FILE_SCANNER_COMMAND` or pass `--scanner-command`. Run `npm run operations:scan -- --limit 25` to poll pending scans, download private files, run the scanner, and report `clean`, `flagged`, or `failed` through `POST /api/operations/file-scans/:id`. Supabase mode returns short-lived storage URLs; mock/access-request mode returns worker-authenticated app download URLs.
- Monitor runner: report deploy, worker, scanner, backup, and monitoring events with `npm run operations:event -- --source systemd --event-type deploy.completed --metadata release=v1.x`. Schedule the canonical heartbeat with `npm run operations:heartbeat -- --metadata schedule=hourly` so `/admin/readiness` can verify monitoring. If `COFOUNDRY_ALERT_WEBHOOK_URL` is set, run `systemctl start cofoundry-operations-alert-smoke.service` after changing the destination, or run `npm run operations:alert-smoke -- --metadata runbook=manual` directly before unit templates are installed; warning and error events from this worker, failed backups, failed restore drills, and scanner failures also post to the configured webhook without blocking telemetry persistence.
- Realtime smoke runner: after configuring `COFOUNDRY_REALTIME_FANOUT_URL` for a multi-instance host, run `systemctl start cofoundry-operations-realtime-smoke.service` from the server. Before systemd templates are installed, call `npm run operations:realtime-smoke -- --min-delivered 0` directly to prove authenticated ingress and telemetry. For full cross-instance proof, connect a member `/api/workspace/events` SSE stream to another app instance and run with `--min-delivered 1` or higher.
- Restore drill runner: wrap a staging restore verification command with `npm run operations:restore-drill -- --id restore-YYYYMMDD -- <restore verification command>`.

Each worker call must send `Authorization: Bearer <COFOUNDRY_OPERATIONS_TOKEN>` or `x-cofoundry-operations-token`.

## Realtime Scaling

The checked-in workspace realtime path is production-safe for a single Node process: authenticated members subscribe to `/api/workspace/events`, writes emit local SSE invalidation, typing presence is non-persistent, and clients fall back to visible polling when the stream disconnects.

If production runs multiple app instances, add an internal relay before relying on push-style realtime across instances:

1. Set `COFOUNDRY_EXPECT_MULTI_INSTANCE=true`, `COFOUNDRY_APP_INSTANCE_COUNT=<count>`, and a stable `COFOUNDRY_INSTANCE_ID` per process.
2. Set `COFOUNDRY_REALTIME_FANOUT_URL` to a server-side relay endpoint. The app will POST signed realtime envelopes there after local delivery.
3. Configure the relay to POST each envelope to every app instance at `/api/operations/realtime-events` with `Authorization: Bearer <COFOUNDRY_OPERATIONS_TOKEN>`.
4. Keep the relay on private networking when possible. The endpoint fails closed without the operations token and ignores malformed envelopes, but it should not be exposed as a public integration surface.
5. Run `npm run operations:realtime-smoke -- --min-delivered 0` or `systemctl start cofoundry-operations-realtime-smoke.service` and confirm `/admin/readiness` records the smoke event. This proves protected relay ingress and telemetry without requiring a live member stream.
6. Run a relay smoke with two app instances: connect a member workspace stream to instance B, perform a collaboration or typing action on instance A, then run the smoke with `--min-delivered 1` or higher and confirm instance B receives the SSE event without waiting for polling fallback.

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
6. Verify the bootstrap `admin_actions` row appears in `/admin/audit`, and confirm `/admin/readiness` shows active admin access passing with first-admin bootstrap audit evidence recorded.
7. Verify the user can access `/admin`, `/admin/users`, `/admin/audit`, `/admin/operations`, `/admin/access-requests`, `/admin/privacy`, `/admin/queue`, and `/admin/evidence` from a staging or maintenance app process running in Supabase mode.
8. Only then keep the production app process on `NUXT_PUBLIC_BACKEND_MODE=supabase`.

## Stripe Cutover

- Keep `NUXT_PUBLIC_BILLING_MODE=mock` until checkout, customer portal, webhook signature validation, and subscription reconciliation have been tested against a staging Stripe account.
- With live accounts and mock billing, paid-plan changes are operator-managed and should not grant paid entitlements unless `NUXT_PUBLIC_ENABLE_DEMO_ACCESS=true` is deliberately set for staging.
- Enable Stripe only after the webhook endpoint is registered and `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, public price IDs, and the publishable key are present in the host secret/public env model.
- After the first signed checkout or subscription webhook, confirm `/admin/operations` shows `stripe.webhook.processed`; Stripe-mode readiness remains a warning until that row exists.
