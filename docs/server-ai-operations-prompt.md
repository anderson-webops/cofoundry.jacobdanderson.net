# Server AI Operations Prompt

Use this prompt after deploying the CoFoundry source that includes the worker-authenticated `/api/operations/*` endpoints.

```text
You are configuring the production server for CoFoundry.

Current application goal:
- Keep the public production site in its current behavior unless explicitly enabling Supabase/Stripe.
- Do not switch production into live Supabase or Stripe modes unless the operator confirms the required secrets and migrations are ready.
- Configure worker-side operations that the source now exposes through authenticated endpoints.

Source/runtime context:
- Production app command should keep using host process env only.
- Backend production start remains `node dist/server.js`; do not add dotenv/dotenvx loading to production startup.
- Server-only secrets must come from Vault-managed or host-managed env files.
- Deployment identity values are non-secret. Prefer setting `COFOUNDRY_RELEASE`, `COFOUNDRY_COMMIT_SHA`, and `COFOUNDRY_DEPLOYED_AT` from the deploy pipeline or host unit env, but the Nuxt build bakes in the current Git commit as a fallback when `COFOUNDRY_COMMIT_SHA` is missing.
- The app now supports a server-only `COFOUNDRY_OPERATIONS_TOKEN`.
- The worker CLI also supports optional server-only alert webhook env: `COFOUNDRY_ALERT_WEBHOOK_URL`, `COFOUNDRY_ALERT_WEBHOOK_TOKEN`, `COFOUNDRY_ALERT_SEVERITIES`, and `COFOUNDRY_ALERT_TIMEOUT_MS`. Leave these unset until the operator chooses the destination.
- Email-suppression provider readiness is optional. Leave `COFOUNDRY_EMAIL_SUPPRESSION_PROVIDER` and `COFOUNDRY_MAIL_SUPPRESSION_PROVIDER` unset until the outbound mail provider's bounce, complaint, unsubscribe, and manual-suppression callbacks are mapped. Once either marker is set, `/admin/readiness` expects recent suppression evidence.
- Trust-provider readiness is optional. Leave `COFOUNDRY_TRUST_VERIFICATION_PROVIDER`, `COFOUNDRY_IDENTITY_VERIFICATION_PROVIDER`, `COFOUNDRY_DOMAIN_VERIFICATION_PROVIDER`, and `COFOUNDRY_SOCIAL_VERIFICATION_PROVIDER` unset until the operator chooses the corresponding provider. Once any marker is set, `/admin/readiness` expects recent trust-verification evidence.
- Contract-envelope provider readiness is optional. Leave `COFOUNDRY_CONTRACT_ENVELOPE_PROVIDER`, `COFOUNDRY_ESIGNATURE_PROVIDER`, and `COFOUNDRY_PDF_PROVIDER` unset unless a dedicated e-signature/PDF provider is selected. Once any marker is set, `/admin/readiness` expects recent completed envelope evidence.
- The source includes schedulable worker commands: `npm run operations:backup`, `npm run operations:digest`, `npm run operations:scan`, `npm run operations:heartbeat`, `npm run operations:alert-smoke`, `npm run operations:event`, `npm run operations:mail-smoke`, `npm run operations:realtime-smoke`, `npm run operations:worker -- lifecycle-notification`, `npm run operations:worker -- email-suppression`, `npm run operations:worker -- contract-envelope`, `npm run operations:trust-verification`, and `npm run operations:restore-drill`.
- The source includes systemd templates and a dry-run capable installer in `deploy/systemd/`. Prefer `sudo deploy/systemd/install-operations-units.sh --dry-run` followed by a reviewed install instead of hand-writing timer units from scratch.
- In mock/access-request mode, operations telemetry persists to `.data/operations-telemetry.json` and local uploaded scan artifacts persist under `.data/local-file-uploads/` unless `COFOUNDRY_LOCAL_DATA_DIR` points at another durable writable directory.

Tasks:
1. Pull and deploy the latest `main` commit or the current `v1.x` release tag.
2. After deploy, run the live-origin verifier locally and publish the result through GitHub Actions if a GitHub token or CLI is available:

   VERIFY_PUBLIC_EXPECT_RELEASE=<release> VERIFY_PUBLIC_EXPECT_COMMIT_SHA=<commit> npm run verify:public

   npm run verify:public:dispatch -- --dry-run --expected-release <release> --expected-commit-sha <commit>

   GITHUB_TOKEN=<token-with-actions-or-repo-dispatch-access> npm run verify:public:dispatch -- \
     --expected-release <release> \
     --expected-commit-sha <commit>

   If the GitHub CLI is already installed, the equivalent manual trigger is:

   gh workflow run public-site-verification.yml \
     -R anderson-webops/cofoundry.jacobdanderson.net \
     -f base_url=https://cofoundry.jacobdanderson.net \
     -f expected_release=<release> \
     -f expected_commit_sha=<commit> \
     -f require_deployment_identity=true

   The checked-in dispatcher sends event type `cofoundry-deployed` with `client_payload.base_url`, `client_payload.expected_release`, `client_payload.expected_commit_sha`, and `client_payload.require_deployment_identity`.
3. Generate a long random `COFOUNDRY_OPERATIONS_TOKEN` and add it to the Vault/host env file consumed by the Nuxt server process only.
4. Set `COFOUNDRY_RELEASE`, `COFOUNDRY_COMMIT_SHA`, and `COFOUNDRY_DEPLOYED_AT` from the deploy pipeline or host unit env when available, then confirm `/api/health` shows at least release or commit after restart. If `COFOUNDRY_COMMIT_SHA` is omitted, verify the Nuxt build fallback exposes the checked-out Git commit.
5. Ensure the app process can write to `.data/operations-telemetry.json` and `.data/local-file-uploads/`, or set `COFOUNDRY_LOCAL_DATA_DIR` to a durable writable host path and optionally set `COFOUNDRY_OPERATIONS_RETENTION_LIMIT`.
6. Restart the app and verify production logs do not mention loading `../.env`.
7. If Supabase mode is not intentionally enabled, leave `NUXT_PUBLIC_BACKEND_MODE="mock"` and verify the public site remains a marketing/access-request shell.
8. If Supabase mode is intentionally enabled, verify all migrations in `back-end/supabase/migrations/` have been applied and that `SUPABASE_SERVICE_ROLE_KEY`, `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY`, and `SESSION_SIGNING_SECRET` are present.
9. Preview and install the checked-in unit templates from `deploy/systemd/`, or create equivalent cron entries only if systemd is unavailable:

   sudo deploy/systemd/install-operations-units.sh --dry-run
   sudo deploy/systemd/install-operations-units.sh

   The installer creates `/etc/cofoundry/operations.env` from the example only when it does not already exist, enables heartbeat/digest/scan/backup timers by default, and leaves the restore-drill timer disabled unless `--enable-restore-drill` is passed. Fill in host values from Vault-managed env, and adjust `User=`, `Group=`, and `WorkingDirectory=` in the templates before installation if needed. If an alerting destination exists, add `COFOUNDRY_ALERT_WEBHOOK_URL`, optional `COFOUNDRY_ALERT_WEBHOOK_TOKEN`, optional `COFOUNDRY_ALERT_SEVERITIES=error,warning`, and optional `COFOUNDRY_ALERT_TIMEOUT_MS=10000` to the same server-only worker env file. If mail smoke checks are expected, add `COFOUNDRY_MAIL_SMOKE_TO_EMAIL=<monitored-inbox>`. If the host uses more than one app instance or a realtime relay, add `COFOUNDRY_REALTIME_SMOKE_USER_ID=<test-user-id>` and keep `COFOUNDRY_REALTIME_SMOKE_MIN_DELIVERED=0` for ingress-only smoke until a cross-instance member SSE stream is intentionally connected.
10. Create a systemd timer or equivalent cron for unread digests. First run dry-run mode with the checked-in worker:

   npm run operations:digest -- --dry-run --max-users 100

   The raw endpoint equivalent is:

   curl -fsS -X POST "$NUXT_PUBLIC_APP_URL/api/operations/notification-digests/run" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"dryRun":true,"maxUsers":100,"onlyWithUnread":true}'

   After dry-run verification, SMTP verification, confirmation that intended pilot users enabled scheduled digest email in `/app/settings`, and a successful test of the signed `/email/preferences?token=...` link from a received message, switch `dryRun` to `false`.

11. Verify mail transport with a controlled smoke test after configuring SMTP or sendmail env:

   If the checked-in systemd templates are installed:

   systemctl start cofoundry-operations-mail-smoke.service

   Otherwise run the worker directly:

   npm run operations:mail-smoke -- \
     --to-email "<monitored-inbox>" \
     --metadata purpose=mail-provider-smoke

   Confirm the monitored inbox receives the message, then confirm `/admin/operations` and `/admin/readiness` show a recent `mail.smoke` delivery row. If this fails, keep digest and lifecycle sends in dry-run or record-only mode.

   Before enabling real optional sends, wire provider unsubscribe, bounce, complaint, and manual suppression events to the checked-in suppression endpoint. Example:

   npm run operations:worker -- email-suppression \
     --email "<recipient-email>" \
     --category all \
     --reason complaint \
     --provider "<mail-provider>" \
     --source-event-id "<provider-event-id>" \
     --metadata providerType=spam_complaint

   The raw endpoint equivalent is:

   curl -fsS -X POST "$NUXT_PUBLIC_APP_URL/api/operations/email-suppressions" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"email":"<recipient-email>","category":"all","reason":"complaint","provider":"<mail-provider>","sourceEventId":"<provider-event-id>","metadata":{"providerType":"spam_complaint"}}'

   Confirm `/admin/operations` shows the email suppression row. Optional scheduled digest and relationship workflow emails skip suppressed recipients before live send attempts.

12. If an e-signature or PDF provider is selected, wire provider envelope events to the checked-in contract-envelope endpoint:

   npm run operations:worker -- contract-envelope \
     --contract-id "<contract-id>" \
     --contract-version-id "<contract-version-id>" \
     --provider-envelope-id "<provider-envelope-id>" \
     --status completed \
     --provider "<signature-provider>" \
     --completed-pdf-file-upload-id "<file-upload-id>" \
     --completed-pdf-sha256 "<64-char-sha256>" \
     --signed-by-user-id "<user-id>" \
     --source-event-id "<provider-event-id>"

   The raw endpoint equivalent is:

   curl -fsS -X POST "$NUXT_PUBLIC_APP_URL/api/operations/contract-envelopes" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"contractId":"<contract-id>","contractVersionId":"<contract-version-id>","providerEnvelopeId":"<provider-envelope-id>","status":"completed","provider":"<signature-provider>","completedPdfFileUploadId":"<file-upload-id>","completedPdfSha256":"<64-char-sha256>","signedByUserIds":["<user-id>"],"sourceEventId":"<provider-event-id>"}'

   Confirm `/admin/operations` shows the envelope row. Download the matching contract certificate and confirm the provider evidence section includes the envelope id and completed PDF hash.

13. If phone, social/OAuth, work-domain, identity, or opportunity-ownership providers are selected, wire provider trust-verification events to the checked-in trust endpoint:

   npm run operations:trust-verification -- \
     --target-type profile \
     --target-id "<profile-id>" \
     --verification-type government_id \
     --status verified \
     --provider "<trust-provider>" \
     --provider-subject-id "<provider-subject-id>" \
     --source-event-id "<provider-event-id>" \
     --confidence "0.94"

   The raw endpoint equivalent is:

   curl -fsS -X POST "$NUXT_PUBLIC_APP_URL/api/operations/trust-verifications" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"targetType":"profile","targetId":"<profile-id>","verificationType":"government_id","status":"verified","provider":"<trust-provider>","providerSubjectId":"<provider-subject-id>","sourceEventId":"<provider-event-id>","confidence":0.94}'

   Confirm `/admin/operations` shows the trust-verification row. If `COFOUNDRY_TRUST_VERIFICATION_PROVIDER` or another trust-provider marker is set, confirm `/admin/readiness` also shows the trust-verification evidence check passing. Treat this as provider evidence for operator review or future policy wiring; do not grant member-facing trust badges solely from a webhook unless the application source has been updated to encode that decision.

14. Verify lifecycle notification rendering and telemetry before wiring live event triggers:

   npm run operations:worker -- lifecycle-notification \
     --dry-run \
     --event-type proposal.received \
     --target-type proposal \
     --target-id "<proposal-id>" \
     --user-id "<recipient-user-id>"

   The raw endpoint equivalent is:

   curl -fsS -X POST "$NUXT_PUBLIC_APP_URL/api/operations/notifications/lifecycle" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"dryRun":true,"eventType":"proposal.received","targetType":"proposal","targetId":"<proposal-id>","userId":"<recipient-user-id>"}'

   Mock/access-request mode records the attempt without sending mail. In Supabase mode, keep `dryRun` true until SMTP is verified, intended pilot users have enabled relationship workflow email in `/app/settings`, the signed `/email/preferences?token=...` link has been tested from a received message, and lifecycle triggers are connected to the app events that create or accept intros, send unread messages, create or update proposals, require signatures, review reports, and change billing state.

15. Wire the database backup job through the checked-in lifecycle wrapper:

   npm run operations:backup -- \
     --provider server-pg-dump \
     --artifact-uri "file:///var/backups/cofoundry/latest.dump" \
     -- pg_dump "$DATABASE_URL" --file /var/backups/cofoundry/latest.dump

   The raw endpoint equivalent is:

   curl -fsS -X POST "$NUXT_PUBLIC_APP_URL/api/operations/backup-runs" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"id":"backup-YYYYMMDD-HHMM","provider":"server-pg-dump","status":"running","startedAt":"<ISO timestamp>"}'

   On success or failure, call the same endpoint with `status`, `completedAt`, `artifactUri`, `notes`, and useful metadata.

16. Wire the file scanner worker to read the app-managed pending scan queue. Prefer the checked-in worker with the server's approved scanner:

   COFOUNDRY_FILE_SCANNER_COMMAND="clamscan --no-summary" npm run operations:scan -- --limit 25

   The raw endpoint equivalent starts with:

   curl -fsS "$NUXT_PUBLIC_APP_URL/api/operations/file-scans/pending?limit=25" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN"

   For each row, download `signedDownloadUrl`, scan it with the server's approved malware/content scanner, and report results. In Supabase mode, `signedDownloadUrl` is a short-lived storage URL. In mock/access-request mode, it is an app URL under `/api/operations/file-scans/<upload-id>/download`, so include `Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN` when downloading it.

   curl -fsS -X POST "$NUXT_PUBLIC_APP_URL/api/operations/file-scans/<upload-id>" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"scanStatus":"clean","status":"uploaded","notes":"Scanner name/version and signature timestamp"}'

17. Wire deploy, backup, scanner, and monitoring failures through the checked-in event reporter:

   npm run operations:event -- \
     --source systemd-timer \
     --event-type backup.failed \
     --severity error \
     --metadata runId=backup-YYYYMMDD-HHMM

   The raw endpoint equivalent is:

   curl -fsS -X POST "$NUXT_PUBLIC_APP_URL/api/operations/events" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"eventType":"backup.failed","severity":"error","source":"systemd-timer","metadata":{"runId":"backup-YYYYMMDD-HHMM"}}'

   Also report a current monitoring heartbeat so `/admin/readiness` can prove the monitor path is active:

   npm run operations:event -- \
     --source uptime-monitor \
     --event-type monitoring.heartbeat \
     --severity info

   The checked-in canonical command emits the same readiness-recognized event shape and is what the systemd heartbeat template uses:

   npm run operations:heartbeat -- \
     --metadata schedule=hourly

   If `COFOUNDRY_ALERT_WEBHOOK_URL` is configured, verify a warning event reaches the destination without exposing the webhook URL or token in app logs:

   If the checked-in systemd templates are installed:

   systemctl start cofoundry-operations-alert-smoke.service

   Otherwise run the worker directly:

   npm run operations:alert-smoke -- \
     --metadata runbook=manual

18. If `COFOUNDRY_REALTIME_FANOUT_URL` is configured or `COFOUNDRY_EXPECT_MULTI_INSTANCE=true`, verify realtime fanout ingress and telemetry:

   If the checked-in systemd templates are installed:

   systemctl start cofoundry-operations-realtime-smoke.service

   Otherwise run the worker directly:

   npm run operations:realtime-smoke -- \
     --min-delivered 0 \
     --metadata runbook=manual

   Confirm `/admin/operations` shows the `realtime_fanout_smoke_succeeded` row and `/admin/readiness` shows recent workspace realtime fanout evidence. For full cross-instance proof, connect a member `/api/workspace/events` SSE stream to another app instance and rerun with `--min-delivered 1` or higher.

19. Wire a restore drill timer or manual runbook command. `/admin/readiness` should continue to warn until a successful `restore_drill_succeeded` event appears:

   npm run operations:restore-drill -- \
     --id restore-YYYYMMDD \
     --metadata environment=staging \
     -- ./scripts/verify-restored-cofoundry.sh

20. Verify `/admin/operations` shows backup runs, operational events, file uploads, trust verifications, contract envelopes, email suppressions, realtime fanout smoke, and notification deliveries when logged in as an admin.
21. Document timer names, log paths, backup artifact location, scanner command, restore test procedure, local telemetry path, retention limit, mail-smoke result, realtime-smoke result, provider suppression mapping, trust-verification mapping, contract-envelope mapping, lifecycle trigger wiring, and rollback command in the server runbook.
```
