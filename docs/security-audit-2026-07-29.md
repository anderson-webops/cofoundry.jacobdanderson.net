# CoFoundry Security and Privileged-Workflow Audit

Date: 2026-07-29

Scope: frontend SSR/API routes, authentication and session handling, full-admin and investor-admin authorization, promotion/demotion/suspension workflows, member and public data projections, billing, uploads, privacy and moderation queues, Supabase functions and migrations, the standalone backend, operations workers, direct systemd/Nginx deployment, CI, and the npm dependency graph.

## Outcome

The source now fails closed at each reviewed privilege boundary. Browser sessions are only hints until they are revalidated against authoritative user and workspace state. Full-admin mutations are atomic, auditable, stale-checked, and protected against self-modification or removal of the last active verified administrator. Investor administrators remain limited to opportunity review while the investment feature is enabled.

## Remediated findings

### Authentication and sessions

- Removed onboarding and workspace paths that could derive an administrator role from member-controlled state.
- Revalidate every protected request against durable local or Supabase user state; suspended users and stale roles are rejected immediately.
- Use timed, domain-separated HMAC session signatures with a twelve-hour maximum age.
- Require at least twelve characters for new passwords and use scrypt plus a dummy verification path for durable local authentication.
- Bind access invites to the normalized invited email, require exact generated-token shape, expire and consume invites atomically, and remove invite tokens from browser URLs after intake.
- Generate process-random fallback signing keys for local development; hosted environments require an injected persistent session secret.
- Rebuild missing workspace/subscription state from a free member baseline, never from stale role or plan claims.

### Promotion, demotion, suspension, and review

- Require an active, verified, unsuspended full administrator for role, status, email-verification, report, privacy, access-request, file-scan, and command-queue changes.
- Block administrator self-modification, privileged promotion of unverified or suspended accounts, and demotion or suspension of the last active full administrator.
- Serialize local-mode administrative writes behind one authority lock and recheck the actor immediately before persistence.
- Move Supabase administrative changes into service-role-only functions that lock actor and target rows and write the audit action in the same transaction.
- Keep investor administrators out of user, report, privacy, access, and command-queue administration; their optional scope is opportunity verification only.
- Validate the one-time first-admin bootstrap in both the CLI and database, require a verified target, and reject bootstrap after an active full administrator exists.

### Data authorization and privacy

- Project member workspaces by session and remove unrelated private member, message, proposal, contract, report, application, notification, and operations data.
- Serve the public directory from an explicit redacted static projection rather than live member caches.
- Revoke direct browser access to public-schema tables/functions and force RLS in the security migration; application writes use reviewed server functions.
- Keep uploaded objects private, use short-lived or one-time upload/download credentials, cap uploads at 10 MiB, restrict MIME types, reject path escape and symlink targets, and require scan state before release.
- Require an explicit completion confirmation before a privacy request can be recorded as resolved. An operator note alone can only record review.
- Include a member's own investment applications and privacy/trust requests in the self-service data export while withholding internal operator notes and administrator identifiers.

### Workflow and concurrency integrity

- Make member workspace replacement, collaboration transitions, report/access/privacy review, opportunity verification, signup invite consumption, investment submission, Stripe reconciliation, and provider-event idempotency atomic.
- Serialize access-request intake by normalized email so concurrent duplicate submissions reuse one active request and send one operator notification.
- Reject stale admin forms with expected-status or expected-revision checks.
- Preserve authoritative subscription state unless a billing-specific write explicitly replaces it; a missing row defaults to free with no paid entitlements.

### Backend and host controls

- Bind the standalone backend to loopback by default. A non-loopback bind requires an explicit allow flag and a strong operations token; metadata is authenticated with constant-time comparison.
- Validate canonical hosts, exact trusted-proxy peers, request origin/referrer metadata, declared body sizes, and single-process production operation.
- Derive source-build release identity from the current package version unless deployment metadata is explicitly injected, so a dirty build cannot inherit and advertise its parent tag.
- Apply no-store/noindex defaults to protected routes, a nonce-based content-security policy, strict framing/referrer/permissions headers, and HSTS on production HTTPS origins.
- Validate support mail configuration and reject `security.txt` contact or canonical-origin injection.
- Retire the production container path. Run the built Nuxt server directly as the unprivileged `cofoundry` systemd user, bind it to loopback, keep writable state outside the release tree, and promote immutable release directories through an atomic symlink with health-checked rollback.
- Run operations units as non-root with no new privileges, no capabilities, strict filesystem access, protected kernel/home/proc surfaces, and shell-free executable/argument parsing.
- Pin GitHub Actions by commit, use read-only repository permissions, and disable persisted checkout credentials.
- Keep multi-instance production disabled until a shared atomic rate limiter exists.

### Supply chain

- Align local, CI, Netlify, and direct-host builds on Node 24.18.1 LTS and npm 12.0.2.
- Keep reviewed install scripts in the root allowlist and reject unreviewed lifecycle scripts.
- Upgrade to Stripe 22.4.0 and the compatible Pinia 4.0.2 / `@pinia/nuxt` 1.0.1 pair.
- Retain H3 1.15.11 because the registry's newer line is still a 2.0 release candidate.
- Pin source and deployment text files to LF line endings for reproducible Linux builds and systemd/shell execution.

## Deployment requirements

Source remediation does not replace host provisioning. Before promotion:

1. Apply every migration in `back-end/supabase/migrations/` in timestamp order.
2. Inject distinct session, operations, Supabase, Stripe, and mail secrets only for the enabled modes.
3. Run one application process, keep the standalone backend on loopback unless the documented public-bind controls are all present, and keep the experimental realtime relay disabled.
4. Run the first-admin bootstrap once, then use only the authenticated promotion/demotion workflow.
5. Verify backup, restore-drill, scanner, mail, monitoring, and provider evidence in `/admin/readiness`.
6. Run the checked-in local release gate and verify the deployed release/commit through `/api/health` and the public verification workflow.

## Validation record

The final release validation is recorded in the release commit and tag. The required gate includes a clean `npm ci`, development and production dependency audits, install-script policy, lint, type checking, all frontend and backend tests, build-secret scanning, production smoke tests, public-route crawl, accessibility checks, native optional-package lock verification, secret scanning, and deployment identity checks.
