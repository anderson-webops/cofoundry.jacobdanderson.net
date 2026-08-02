# CoFoundry direct systemd deployment

The production application runs directly with Node. Docker, Compose, Podman, and a container registry are not part of this deployment. The application listens only on `127.0.0.1:3000`; the existing Nginx TLS server remains the public IPv4/IPv6 edge.

## Application service

1. Create the unprivileged `cofoundry` user and the release root `/srv/cofoundry/releases` using the host's normal account-management process.
2. Build and fully validate each release in a new immutable directory under `/srv/cofoundry/releases/<release>-<commit>`. The directory must contain `front-end/.output/server/index.mjs`.
3. Preview and install the application unit and protected env-file template:

```sh
sudo deploy/systemd/install-app-unit.sh --dry-run
sudo deploy/systemd/install-app-unit.sh
```

4. Fill `/etc/cofoundry/app.env` with host-managed values. Blank secret placeholders are intentional so production validation fails until real values are injected.
5. Include `deploy/nginx/cofoundry-proxy.conf.example` inside the existing HTTPS `server` block. Preserve both the existing IPv4 and `[::]` listeners, certificate directives, and HTTP-to-HTTPS redirect.
6. Promote the validated directory. The script changes only the `/srv/cofoundry/current` symlink, restarts the direct Node service, checks `/api/health`, and restores the previous target automatically if the candidate is unhealthy:

```sh
sudo deploy/systemd/promote-release.sh /srv/cofoundry/releases/<release>-<commit>
```

Verify the service and loopback boundary before running the public release verifier:

```sh
systemctl status cofoundry-app.service
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
ss -ltnp | grep '127.0.0.1:3000'
```

To roll back manually, promote the preceding immutable release directory with the same command. Do not edit an already validated release directory in place.

## Operations workers

These additional templates schedule or run the checked-in operations workers without enabling Supabase or Stripe.

### Install

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

### Verify

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

`cofoundry-operations-alert-smoke.service` needs `COFOUNDRY_ALERT_WEBHOOK_URL` to prove external alert delivery. `cofoundry-operations-mail-smoke.service` needs a configured contact mail transport and `COFOUNDRY_MAIL_SMOKE_TO_EMAIL` to prove inbox delivery. The realtime smoke service is for isolated staging development only: production must remain on one app process until a shared atomic rate limiter is implemented. These services persist operations telemetry so `/admin/operations` and `/admin/readiness` can show the result.

### Notes

- The application uses the checked-in `cofoundry-app.service`; the worker templates remain separate so a worker failure cannot replace or broaden the public listener.
- `COFOUNDRY_OPERATIONS_TOKEN` must match the token injected into the Nuxt server process.
- `COFOUNDRY_BACKUP_COMMAND`, `COFOUNDRY_RESTORE_DRILL_COMMAND`, and `COFOUNDRY_FILE_SCANNER_COMMAND` are parsed into an executable plus arguments and are never passed to a shell. Put pipes, redirects, or other compound logic inside a reviewed, host-owned wrapper executable instead of the env value.
- The service sandbox allows writes only under `/var/lib/cofoundry`, `/run/cofoundry`, and the optional `/var/backups/cofoundry` path. Keep provider caches and generated artifacts in those locations.
- `COFOUNDRY_ALERT_WEBHOOK_URL` and `COFOUNDRY_MAIL_SMOKE_TO_EMAIL` belong in `/etc/cofoundry/operations.env` or the host's Vault-managed env material, not in the repository. Keep realtime relay and smoke settings unset in production.
- Keep Supabase and Stripe disabled unless the cutover checklist in `docs/operations-runbook.md` has been completed.
