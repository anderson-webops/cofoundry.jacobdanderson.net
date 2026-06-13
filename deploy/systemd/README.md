# CoFoundry systemd operations templates

These templates schedule the checked-in operations workers without enabling Supabase or Stripe.

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

Then sign in as an admin and confirm `/admin/operations` shows the heartbeat event. Repeat with the digest worker in dry-run mode before enabling real digest delivery.

## Notes

- The app server still uses its normal production unit; these templates only run background worker commands.
- `COFOUNDRY_OPERATIONS_TOKEN` must match the token injected into the Nuxt server process.
- `COFOUNDRY_BACKUP_COMMAND` and `COFOUNDRY_RESTORE_DRILL_COMMAND` should point at host-owned wrapper scripts. Keep those scripts outside the repo if they contain host-specific paths or secrets.
- Keep Supabase and Stripe disabled unless the cutover checklist in `docs/operations-runbook.md` has been completed.
