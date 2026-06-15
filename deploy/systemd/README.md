# CoFoundry systemd operations templates

These templates schedule or run the checked-in operations workers without enabling Supabase or Stripe.

## Install

1. Review the templates and adjust `User=`, `Group=`, and `WorkingDirectory=` if the deployed checkout is not `/srv/cofoundry/current`.
2. Preview the install commands:

```sh
sudo deploy/systemd/install-operations-units.sh --dry-run
```

3. Install the unit files and create `/etc/cofoundry/operations.env` from the example if it does not already exist:

```sh
sudo deploy/systemd/install-operations-units.sh
```

4. Fill in real host values from Vault-managed or host-managed env files.

The installer enables the heartbeat, digest, scan, and backup timers by default. It does not overwrite an existing env file unless `--force-env` is passed, and it does not enable the restore-drill timer unless `--enable-restore-drill` is passed. Use `--no-enable` when you want to copy units and reload systemd without enabling timers yet.

If you are installing by hand instead, copy the unit files to `/etc/systemd/system/`, copy `cofoundry-operations.env.example` to `/etc/cofoundry/operations.env`, run `systemctl daemon-reload`, and enable the timers you are ready to operate:

```sh
systemctl enable --now cofoundry-operations-backup.timer
systemctl enable --now cofoundry-operations-digest.timer
systemctl enable --now cofoundry-operations-scan.timer
systemctl enable --now cofoundry-operations-heartbeat.timer
```

Enable `cofoundry-operations-restore-drill.timer` only after the restore verification command is real and has been tested manually.

## Verify

```sh
systemctl start cofoundry-operations-heartbeat.service
systemctl status cofoundry-operations-heartbeat.service
journalctl -u cofoundry-operations-heartbeat.service -n 100 --no-pager
```

Then sign in as an admin and confirm `/admin/operations` shows the `monitoring.heartbeat` event and `/admin/readiness` marks the monitoring heartbeat check as passing. Repeat with the digest worker in dry-run mode before enabling real digest delivery.

Run manual smoke services after wiring their host secrets:

```sh
systemctl start cofoundry-operations-alert-smoke.service
systemctl start cofoundry-operations-mail-smoke.service
systemctl start cofoundry-operations-realtime-smoke.service
journalctl -u cofoundry-operations-alert-smoke.service -n 100 --no-pager
journalctl -u cofoundry-operations-mail-smoke.service -n 100 --no-pager
journalctl -u cofoundry-operations-realtime-smoke.service -n 100 --no-pager
```

`cofoundry-operations-alert-smoke.service` needs `COFOUNDRY_ALERT_WEBHOOK_URL` to prove external alert delivery. `cofoundry-operations-mail-smoke.service` needs a configured contact mail transport and `COFOUNDRY_MAIL_SMOKE_TO_EMAIL` to prove inbox delivery. `cofoundry-operations-realtime-smoke.service` proves the protected realtime operations ingress and should be run after any multi-instance relay change; keep `COFOUNDRY_REALTIME_SMOKE_MIN_DELIVERED=0` for ingress-only smoke, or set it to `1` or higher when a member SSE stream is intentionally connected on another instance. These services persist operations telemetry so `/admin/operations` and `/admin/readiness` can show the result.

## Notes

- The app server still uses its normal production unit; these templates only run background worker commands.
- `COFOUNDRY_OPERATIONS_TOKEN` must match the token injected into the Nuxt server process.
- `COFOUNDRY_BACKUP_COMMAND` and `COFOUNDRY_RESTORE_DRILL_COMMAND` should point at host-owned wrapper scripts. Keep those scripts outside the repo if they contain host-specific paths or secrets.
- `COFOUNDRY_ALERT_WEBHOOK_URL`, `COFOUNDRY_MAIL_SMOKE_TO_EMAIL`, and realtime smoke settings belong in `/etc/cofoundry/operations.env` or the host's Vault-managed env material, not in the repository.
- Keep Supabase and Stripe disabled unless the cutover checklist in `docs/operations-runbook.md` has been completed.
