# Application configuration contract

The frontend and backend validate configuration at startup. The source checks
exercise synthetic configurations; they do not provision providers or establish
production acceptance.

## Runtime

The reviewed build and service toolchain is Node 26.13.0 with npm 12.2.1.
`deploy/runtime-artifact.json`, `deploy/host-contract.json` and
`deploy/mac-artifact-profile.json` define the artifact and adapter requirements.
Existing Node 24 artifacts retain their original contract and independent
verification. A new runtime declaration does not establish rollback acceptance.

## Storage and identity

`NUXT_PUBLIC_BACKEND_MODE` selects the mock or Supabase backend. Mock mode uses
the external durable directory identified by `COFOUNDRY_LOCAL_DATA_DIR`.
Supabase mode requires the configured public project identity and a server-only
service-role credential. SQL migrations are versioned in
`back-end/supabase/migrations/`.

Sessions require `SESSION_SIGNING_SECRET`. Active persisted accounts and roles
remain authoritative. Provider integration markers are distinct from successful
callback evidence. First-administrator and subsequent authorization decisions
remain protected operational workflows.

## Billing and external providers

`NUXT_PUBLIC_BILLING_MODE` selects mock billing or Stripe. Stripe configuration
includes public price identifiers and server-only API and webhook credentials.
Signed, reconciled webhook evidence is separate from configuration presence.
Provider secrets, production data and private owner instructions are external to
source and release artifacts.

## Readiness and process boundaries

`/api/health` exposes minimal health and release identity. Authorized
`/admin/readiness` and `/admin/operations` distinguish configuration from backup,
restore, monitoring, mail, file-scan and provider evidence. Missing or stale
evidence retains its warning or failed status.

The supported production topology is one application process. The declared
instance count is one, multi-instance mode is false, and the experimental relay
is unset. Shared atomic rate limiting and independent scaling acceptance remain
prerequisites for a different topology.

`COFOUNDRY_OPERATIONS_TOKEN` authenticates worker requests. Optional providers
retain their application-specific access, consent and evidence requirements.
Protected host configuration, activation and recovery acceptance remain separate
from a published source release.
