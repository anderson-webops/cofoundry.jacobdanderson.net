# CoFoundry systemd operations templates

These templates schedule or run the checked-in operations workers without enabling Supabase or Stripe.

## Install

1. Copy the unit files to `/etc/systemd/system/`.
2. Copy `cofoundry-operations.env.example` to `/etc/cofoundry/operations.env`.
3. Fill in real host values from Vault-managed or host-managed env files.
4. Adjust `User=`, `Group=`, and `WorkingDirectory=` if the deployed checkout is not `/srv/cofoundry/current`.
5. Run `systemctl daemon-reload`.
6. Enable the timers you are ready to operate:

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
journalctl -u cofoundry-operations-alert-smoke.service -n 100 --no-pager
journalctl -u cofoundry-operations-mail-smoke.service -n 100 --no-pager
```

`cofoundry-operations-alert-smoke.service` needs `COFOUNDRY_ALERT_WEBHOOK_URL` to prove external alert delivery. `cofoundry-operations-mail-smoke.service` needs a configured contact mail transport and `COFOUNDRY_MAIL_SMOKE_TO_EMAIL` to prove inbox delivery. Both services still persist operations telemetry so `/admin/operations` and `/admin/readiness` can show the result.

## Notes

- The app server still uses its normal production unit; these templates only run background worker commands.
- `COFOUNDRY_OPERATIONS_TOKEN` must match the token injected into the Nuxt server process.
- `COFOUNDRY_BACKUP_COMMAND` and `COFOUNDRY_RESTORE_DRILL_COMMAND` should point at host-owned wrapper scripts. Keep those scripts outside the repo if they contain host-specific paths or secrets.
- `COFOUNDRY_ALERT_WEBHOOK_URL` and `COFOUNDRY_MAIL_SMOKE_TO_EMAIL` belong in `/etc/cofoundry/operations.env` or the host's Vault-managed env material, not in the repository.
- Keep Supabase and Stripe disabled unless the cutover checklist in `docs/operations-runbook.md` has been completed.
