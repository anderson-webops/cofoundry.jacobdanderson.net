# CoFoundry direct systemd deployment

The application runs directly with Node. The preserved host profile has a frontend on `127.0.0.1:4013` and backend on `127.0.0.1:3015`; the existing Nginx TLS server remains the public IPv4/IPv6 edge. Development acceptance containers are separate from this production topology. Source templates describe the two-service profile; their installation remains subject to protected adapter and rollback acceptance.

## Tagged runtime assets

Current native Mac publication uses the six-asset Ed25519 transport in `docs/native-mac-transport.md`, preserving the independent runtime inventory. A clean Linux ARM64 build with pinned Node/npm, audits and tests precedes isolated unpacked-runtime, missing-module and failed-promotion acceptance. Public source identity, signed transport identity, protected host intake, rollback acceptance and activation are separate outcomes. Earlier GitHub-attested releases and their distinct asset convention retain their original identities.

Artifact-only intake is a separate protected host capability. This source workflow neither activates it nor changes a running service. Until it is accepted, the existing host build path remains the only active path; an artifact-only adapter must defer missing or untrusted assets rather than compiling as a fallback.

## Application service

1. Create the unprivileged `cofoundry` user, `/srv/cofoundry/releases`, `/var/lib/cofoundry`, `/run/cofoundry`, and `/var/backups/cofoundry` using the host's normal account-management process. Writable state remains outside immutable releases and must survive both promotion and rollback.
2. On a clean Linux ARM64 checkout, run `npm run package:runtime -- .ai-work/runs/<empty-run>`. The packager requires Node 26.13.0/npm 12.2.1, uses the full locked graph to build the exact commit, stages only the backend production dependency closure, writes a source-bound manifest, and exercises the unpacked frontend, backend, operations worker, probes, graceful shutdown, post-copy verification, and missing-module failure in a network-isolated sandbox without the source checkout or development dependencies. It also emits a separate digest-bound host-control bundle containing the systemd unit, installer, promoter, and verifiers.
3. Transfer both archives, both SHA-256 values, the exact commit, and the accepted unpacked runtime tree through the protected release intake. Make the staged tree and archives root-owned and not group/world writable. Never copy credentials, host env files, local databases, uploads, caches, or writable queues into a release.
4. Preview and install the host controls from the immutable Git object and reviewed control archive. Do not run a privileged multi-file copy directly from a mutable checkout:

```sh
/usr/bin/git show <commit>:deploy/systemd/install-app-unit.sh \
  | sudo /bin/bash -s -- \
      --bundle /srv/cofoundry/artifacts/<release>-host-controls.tar.gz \
      --sha256 <control-bundle-sha256> \
      --commit <commit> \
      --dry-run

/usr/bin/git show <commit>:deploy/systemd/install-app-unit.sh \
  | sudo /bin/bash -s -- \
      --bundle /srv/cofoundry/artifacts/<release>-host-controls.tar.gz \
      --sha256 <control-bundle-sha256> \
      --commit <commit>
```

The installer copies the archive once into root-only staging, verifies the reviewed digest and manifest, creates a versioned root-owned control directory, and atomically switches `/usr/local/libexec/cofoundry/current`. Later upgrades may invoke the installed `current/install-app-unit.sh`; previously installed control bundles remain available for recovery.

5. Fill `/etc/cofoundry/app.env` with host-managed values. Blank secret placeholders are intentional so production validation fails until real values are injected. Deployment identity values must match the candidate or remain blank so the built fallback is authoritative. The paired Nginx upstream uses `127.0.0.1`, so this deployment requires `COFOUNDRY_TRUST_PROXY_HEADERS=true` and `COFOUNDRY_TRUSTED_PROXY_IPS=127.0.0.1` to keep public clients' rate-limit buckets separate. Review the actual proxy chain before enabling these exact-peer settings. The installer preserves an existing host env file; update only those nonsecret settings in that file if needed, rather than using `--force-env` and replacing secrets. Keep the generic local `.env.example` untrusted for direct development.
6. Include `deploy/nginx/cofoundry-proxy.conf.example` inside the existing HTTPS `server` block. Preserve both the existing IPv4 and `[::]` listeners, certificate directives, and HTTP-to-HTTPS redirect.
7. Promote with the installed root-owned helper. Supply the independently reviewed archive digest and exact commit. If a current release exists, its retained archive, digest, and commit are mandatory so rollback is revalidated before mutation and again before restoration:

```sh
sudo env \
  ROLLBACK_ARCHIVE=/srv/cofoundry/artifacts/<previous>.tar.gz \
  ROLLBACK_SHA256=<previous-sha256> \
  ROLLBACK_COMMIT=<previous-commit> \
  /usr/local/libexec/cofoundry/current/promote-release.sh \
  /srv/cofoundry/releases/<release>-<commit> \
  /srv/cofoundry/artifacts/<release>.tar.gz \
  <release-sha256> \
  <release-commit>
```

Verify the service and loopback boundary before running the public release verifier:

```sh
systemctl status cofoundry-app.service
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
curl --fail --silent --show-error http://127.0.0.1:3000/healthz
curl --fail --silent --show-error http://127.0.0.1:3000/readyz
ss -ltnp | grep '127.0.0.1:3000'
```

The promoter checks the trusted archive against the staged manifest and every runtime hash, rejects mutable ownership/modes, links, hard links, unexpected executables, development dependencies, and identity drift, serializes promotion, and restores only a separately verified rollback artifact after failed readiness or interruption. A rollback failure retains a root-only JSON record containing both archive paths, digests, commits, targets, timestamps, and state. The app and attacker-facing scan worker use a measured 192 MiB V8 heap ceiling, 320 MiB soft memory boundary, 384 MiB hard cgroup boundary, and 64-task ceiling; change those only after repeating the checked-in workload and high-cardinality rate-limit measurements. To roll back manually, promote the preceding immutable artifact with the same evidence contract. Never edit a validated release directory in place.

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

- The application uses the checked-in `cofoundry-app.service`; the worker templates remain separate so a worker failure cannot replace or broaden the public listener. Production units invoke the pinned Node 26.13.0 binary and compiled JavaScript directly, without npm, tsx, or development dependencies.
- `COFOUNDRY_OPERATIONS_TOKEN` must match the token injected into the Nuxt server process.
- `COFOUNDRY_BACKUP_COMMAND`, `COFOUNDRY_RESTORE_DRILL_COMMAND`, and `COFOUNDRY_FILE_SCANNER_COMMAND` are parsed into an executable plus arguments and are never passed to a shell. Put pipes, redirects, or other compound logic inside a reviewed, host-owned wrapper executable instead of the env value.
- The service sandbox allows writes only under `/var/lib/cofoundry`, `/run/cofoundry`, and the optional `/var/backups/cofoundry` path. Keep provider caches and generated artifacts in those locations.
- `COFOUNDRY_ALERT_WEBHOOK_URL` and `COFOUNDRY_MAIL_SMOKE_TO_EMAIL` belong in `/etc/cofoundry/operations.env` or the host's Vault-managed env material, not in the repository. Keep realtime relay and smoke settings unset in production.
- Supabase and Stripe activation require independent protected provider acceptance; `docs/configuration-contract.md` documents their source configuration boundaries.
