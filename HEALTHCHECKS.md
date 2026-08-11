# Health Checks

Use the following unauthenticated, no-redirect endpoints for monitoring.

## Public Nuxt service

- `GET` or `HEAD /healthz` returns `200` with exactly `{"ok":true}` for
  `GET` and an empty body for `HEAD`.
- `GET` or `HEAD /readyz` checks the configured persistent backend when one is
  enabled. It returns `200` with exactly `{"ok":true}` when ready, otherwise
  `503` with exactly `{"ok":false}`. `HEAD` returns the same status with an
  empty body.

## Operations back-end service

- `GET` or `HEAD /healthz` returns `200` with exactly `{"ok":true}` for
  `GET` and an empty body for `HEAD`.
- `GET` or `HEAD /readyz` returns `200` with exactly `{"ok":true}` because
  this lightweight HTTP service has no request-time external dependency.

All standard probe responses set `Cache-Control: no-store` and return no
cookies, redirects, authentication challenges, secrets, dependency or database
names, host details, process metrics, deployment metadata, or environment
information. The existing `/api/health`, `/health`, `/metadata`, and
`/admin/readiness` surfaces retain their distinct release or operator roles and
must not be used as the minimal monitoring contract.
