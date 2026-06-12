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
- The source includes schedulable worker commands: `npm run operations:backup`, `npm run operations:digest`, `npm run operations:scan`, `npm run operations:event`, and `npm run operations:restore-drill`.
- In mock/access-request mode, operations telemetry persists to `.data/operations-telemetry.json` and local uploaded scan artifacts persist under `.data/local-file-uploads/` unless `COFOUNDRY_LOCAL_DATA_DIR` points at another durable writable directory.

Tasks:
1. Pull and deploy the latest `main` commit or the current `v1.x` release tag.
2. Generate a long random `COFOUNDRY_OPERATIONS_TOKEN` and add it to the Vault/host env file consumed by the Nuxt server process only.
3. Ensure the app process can write to `.data/operations-telemetry.json` and `.data/local-file-uploads/`, or set `COFOUNDRY_LOCAL_DATA_DIR` to a durable writable host path and optionally set `COFOUNDRY_OPERATIONS_RETENTION_LIMIT`.
4. Restart the app and verify production logs do not mention loading `../.env`.
5. If Supabase mode is not intentionally enabled, leave `NUXT_PUBLIC_BACKEND_MODE="mock"` and verify the public site remains a marketing/access-request shell.
6. If Supabase mode is intentionally enabled, verify all migrations in `back-end/supabase/migrations/` have been applied and that `SUPABASE_SERVICE_ROLE_KEY`, `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY`, and `SESSION_SIGNING_SECRET` are present.
7. Create a systemd timer or equivalent cron for unread digests. First run dry-run mode with the checked-in worker:

   npm run operations:digest -- --dry-run --max-users 100

   The raw endpoint equivalent is:

   curl -fsS -X POST "$NUXT_PUBLIC_APP_URL/api/operations/notification-digests/run" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"dryRun":true,"maxUsers":100,"onlyWithUnread":true}'

   After dry-run verification, SMTP verification, and confirmation that intended pilot users enabled scheduled digest email in `/app/settings`, switch `dryRun` to `false`.

8. Wire the database backup job through the checked-in lifecycle wrapper:

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

9. Wire the file scanner worker to read the app-managed pending scan queue. Prefer the checked-in worker with the server's approved scanner:

   COFOUNDRY_FILE_SCANNER_COMMAND="clamscan --no-summary" npm run operations:scan -- --limit 25

   The raw endpoint equivalent starts with:

   curl -fsS "$NUXT_PUBLIC_APP_URL/api/operations/file-scans/pending?limit=25" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN"

   For each row, download `signedDownloadUrl`, scan it with the server's approved malware/content scanner, and report results. In Supabase mode, `signedDownloadUrl` is a short-lived storage URL. In mock/access-request mode, it is an app URL under `/api/operations/file-scans/<upload-id>/download`, so include `Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN` when downloading it.

   curl -fsS -X POST "$NUXT_PUBLIC_APP_URL/api/operations/file-scans/<upload-id>" \
     -H "Authorization: Bearer $COFOUNDRY_OPERATIONS_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"scanStatus":"clean","status":"uploaded","notes":"Scanner name/version and signature timestamp"}'

10. Wire deploy, backup, scanner, and monitoring failures through the checked-in event reporter:

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

11. Wire a restore drill timer or manual runbook command:

   npm run operations:restore-drill -- \
     --id restore-YYYYMMDD \
     --metadata environment=staging \
     -- ./scripts/verify-restored-cofoundry.sh

12. Verify `/admin/operations` shows backup runs, operational events, file uploads, and notification deliveries when logged in as an admin.
13. Document timer names, log paths, backup artifact location, scanner command, restore test procedure, local telemetry path, retention limit, and rollback command in the server runbook.
```
