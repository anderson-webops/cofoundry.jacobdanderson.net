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
- The app now supports a server-only `COFOUNDRY_OPERATIONS_TOKEN`.
- The worker CLI also supports optional server-only alert webhook env: `COFOUNDRY_ALERT_WEBHOOK_URL`, `COFOUNDRY_ALERT_WEBHOOK_TOKEN`, `COFOUNDRY_ALERT_SEVERITIES`, and `COFOUNDRY_ALERT_TIMEOUT_MS`. Leave these unset until the operator chooses the destination.
- The source includes schedulable worker commands: `npm run operations:backup`, `npm run operations:digest`, `npm run operations:scan`, `npm run operations:event`, `npm run operations:mail-smoke`, `npm run operations:worker -- lifecycle-notification`, and `npm run operations:restore-drill`.
- The source includes systemd templates in `deploy/systemd/`. Prefer installing and tuning those templates instead of hand-writing timer units from scratch.
- In mock/access-request mode, operations telemetry persists to `.data/operations-telemetry.json` and local uploaded scan artifacts persist under `.data/local-file-uploads/` unless `COFOUNDRY_LOCAL_DATA_DIR` points at another durable writable directory.

Tasks:
1. Pull and deploy the latest `main` commit or the current `v1.x` release tag.
2. Generate a long random `COFOUNDRY_OPERATIONS_TOKEN` and add it to the Vault/host env file consumed by the Nuxt server process only.
3. Ensure the app process can write to `.data/operations-telemetry.json` and `.data/local-file-uploads/`, or set `COFOUNDRY_LOCAL_DATA_DIR` to a durable writable host path and optionally set `COFOUNDRY_OPERATIONS_RETENTION_LIMIT`.
4. Restart the app and verify production logs do not mention loading `../.env`.
5. If Supabase mode is not intentionally enabled, leave `NUXT_PUBLIC_BACKEND_MODE="mock"` and verify the public site remains a marketing/access-request shell.
6. If Supabase mode is intentionally enabled, verify all migrations in `back-end/supabase/migrations/` have been applied and that `SUPABASE_SERVICE_ROLE_KEY`, `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY`, and `SESSION_SIGNING_SECRET` are present.
7. Install the checked-in unit templates from `deploy/systemd/` or create equivalent cron entries. Copy `deploy/systemd/cofoundry-operations.env.example` to `/etc/cofoundry/operations.env`, fill in host values from Vault-managed env, and adjust `User=`, `Group=`, and `WorkingDirectory=` if needed. If an alerting destination exists, add `COFOUNDRY_ALERT_WEBHOOK_URL`, optional `COFOUNDRY_ALERT_WEBHOOK_TOKEN`, optional `COFOUNDRY_ALERT_SEVERITIES=error,warning`, and optional `COFOUNDRY_ALERT_TIMEOUT_MS=10000` to the same server-only worker env file.
8. Create a systemd timer or equivalent cron for unread digests. First run dry-run mode with the checked-in worker:

   npm run operations:digest -- --dry-run --max-users 100

   The raw endpoint equivalent is:

   curl -fsS -X POST "$NUXT_PUBLIC_APP_URL/api/operations/notification-digests/run" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"dryRun":true,"maxUsers":100,"onlyWithUnread":true}'

   After dry-run verification, SMTP verification, and confirmation that intended pilot users enabled scheduled digest email in `/app/settings`, switch `dryRun` to `false`.

9. Verify mail transport with a controlled smoke test after configuring SMTP or sendmail env:

   npm run operations:mail-smoke -- \
     --to-email "<monitored-inbox>" \
     --metadata purpose=mail-provider-smoke

   Confirm the monitored inbox receives the message, then confirm `/admin/operations` and `/admin/readiness` show a recent `mail.smoke` delivery row. If this fails, keep digest and lifecycle sends in dry-run or record-only mode.

10. Verify lifecycle notification rendering and telemetry before wiring live event triggers:

   npm run operations:worker -- lifecycle-notification \
     --dry-run \
     --event-type proposal.updated \
     --target-type proposal \
     --target-id "<proposal-id>" \
     --user-id "<recipient-user-id>"

   The raw endpoint equivalent is:

   curl -fsS -X POST "$NUXT_PUBLIC_APP_URL/api/operations/notifications/lifecycle" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"dryRun":true,"eventType":"proposal.updated","targetType":"proposal","targetId":"<proposal-id>","userId":"<recipient-user-id>"}'

   Mock/access-request mode records the attempt without sending mail. In Supabase mode, keep `dryRun` true until SMTP is verified and lifecycle triggers are connected to the app events that create matches, unread messages, proposal updates, required signatures, report reviews, and subscription changes.

11. Wire the database backup job through the checked-in lifecycle wrapper:

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

12. Wire the file scanner worker to read the app-managed pending scan queue. Prefer the checked-in worker with the server's approved scanner:

   COFOUNDRY_FILE_SCANNER_COMMAND="clamscan --no-summary" npm run operations:scan -- --limit 25

   The raw endpoint equivalent starts with:

   curl -fsS "$NUXT_PUBLIC_APP_URL/api/operations/file-scans/pending?limit=25" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN"

   For each row, download `signedDownloadUrl`, scan it with the server's approved malware/content scanner, and report results. In Supabase mode, `signedDownloadUrl` is a short-lived storage URL. In mock/access-request mode, it is an app URL under `/api/operations/file-scans/<upload-id>/download`, so include `Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN` when downloading it.

   curl -fsS -X POST "$NUXT_PUBLIC_APP_URL/api/operations/file-scans/<upload-id>" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"scanStatus":"clean","status":"uploaded","notes":"Scanner name/version and signature timestamp"}'

13. Wire deploy, backup, scanner, and monitoring failures through the checked-in event reporter:

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

   If `COFOUNDRY_ALERT_WEBHOOK_URL` is configured, verify a warning or error event reaches the destination without exposing the webhook URL or token in app logs:

   npm run operations:event -- \
     --source uptime-monitor \
     --event-type monitoring.alert_test \
     --severity warning \
     --metadata purpose=alert-webhook-smoke

14. Wire a restore drill timer or manual runbook command. `/admin/readiness` should continue to warn until a successful `restore_drill_succeeded` event appears:

   npm run operations:restore-drill -- \
     --id restore-YYYYMMDD \
     --metadata environment=staging \
     -- ./scripts/verify-restored-cofoundry.sh

15. Verify `/admin/operations` shows backup runs, operational events, file uploads, and notification deliveries when logged in as an admin.
16. Document timer names, log paths, backup artifact location, scanner command, restore test procedure, local telemetry path, retention limit, mail-smoke result, lifecycle trigger wiring, and rollback command in the server runbook.
```
