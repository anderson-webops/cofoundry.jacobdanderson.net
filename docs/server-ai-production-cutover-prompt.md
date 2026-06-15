# Server AI Prompt: Production Provider Cutover

Use this prompt only after CoFoundry has been deployed in stable mock/access-request mode and the operator is ready to wire external production providers. This prompt is intentionally staged so the server can configure one provider surface at a time without accidentally enabling Supabase, Stripe, OAuth, or email before their verification gates pass.

```text
You are configuring CoFoundry's production provider cutover on the host server.

Current source posture:
- CoFoundry is safe to run publicly in mock/access-request mode.
- Public env can live in normal host env files.
- Server-only secrets must come from Vault-managed or equivalent host-managed env files.
- Production startup must use host process env only. Do not add dotenv or dotenvx loading to production startup paths.
- Supabase, Stripe, OAuth, outbound email, worker timers, and scanner/backup providers must remain disabled until each section below passes its own verification gate.

Global rules:
1. Work from the latest validated `v1.x` release tag or the deployed `main` commit.
2. Do not commit secrets, generated env files, backup artifacts, local telemetry stores, or provider credentials.
3. Keep `NUXT_PUBLIC_ENABLE_DEMO_ACCESS=false` on production-facing hosts.
4. Keep `NUXT_PUBLIC_BACKEND_MODE=mock` and `NUXT_PUBLIC_BILLING_MODE=mock` unless the operator explicitly authorizes that provider cutover step.
5. After each provider step, restart only the service that needs the changed env and verify `/admin/readiness` before proceeding.

Stage 1: durable mock/access-request baseline
1. Configure `NUXT_PUBLIC_APP_URL=https://cofoundry.jacobdanderson.net` or the operator-approved HTTPS production origin in normal host env. Do not set `COFOUNDRY_ALLOW_LOCAL_PUBLIC_APP_URL` on hosted production.
2. Configure `SESSION_SIGNING_SECRET`, `COFOUNDRY_LOCAL_DATA_DIR`, and `COFOUNDRY_OPERATIONS_TOKEN` from Vault/host env.
3. Configure non-secret deployment identity values `COFOUNDRY_RELEASE`, `COFOUNDRY_COMMIT_SHA`, and `COFOUNDRY_DEPLOYED_AT` from the deploy pipeline or host unit env.
4. Confirm `/api/health` and `/admin/readiness` show the expected release tag or commit SHA.
5. Confirm the app user can write access requests, local auth accounts, member workspace state, collaboration state, admin audit overlays, operations telemetry, and local file-upload scan artifacts.
6. Confirm `/auth/sign-up`, `/auth/recover`, `/admin/access-requests`, `/admin/audit`, `/admin/operations`, and `/admin/readiness` work after an app restart.
7. Leave Supabase and Stripe disabled at the end of this stage.

Stage 2: outbound email provider
1. Choose the transactional mail provider and verified sending domain.
2. Add only server-side mail credentials to Vault/host env.
3. Configure contact/access-request/digest/lifecycle delivery env without exposing provider secrets to the client.
4. Run `npm run operations:mail-smoke -- --to-email <monitored-inbox>` and confirm both inbox receipt and `mail.smoke` telemetry in `/admin/operations`.
5. Send a contact-form test, an access-request notification, a dry-run notification digest, and a dry-run lifecycle notification.
6. If the mail provider supports suppression callbacks, set `COFOUNDRY_EMAIL_SUPPRESSION_PROVIDER=<provider>`, map provider suppression events into `/api/operations/email-suppressions`, and confirm `/admin/readiness` shows suppression evidence passing.
7. Only enable scheduled real digest sends after member digest preferences, workflow email preferences, signed preference-management links, `List-Unsubscribe` headers, provider suppression events, and the support inbox have been verified. Test at least one `/email/preferences?token=...` link from a received digest or workflow email before turning on real schedules.
8. Confirm `/admin/readiness` no longer warns on mail delivery readiness.

Stage 3: operations workers
1. Install or tune the checked-in systemd templates under `deploy/systemd/`.
2. Wire backup lifecycle reporting, file scanning, notification digests, monitoring heartbeat events, trust-verification evidence, and restore drills with `COFOUNDRY_OPERATIONS_TOKEN`.
3. If phone, social/OAuth, work-domain, identity, or opportunity-ownership providers are selected, set the matching server-only readiness marker such as `COFOUNDRY_TRUST_VERIFICATION_PROVIDER=<provider>`, map provider results into `/api/operations/trust-verifications`, and confirm the rows appear in `/admin/operations` plus `/admin/readiness` as evidence. Do not treat provider callbacks as automatic member-facing badge grants unless a later source release explicitly encodes that policy.
4. If a dedicated e-signature or PDF provider is selected, set `COFOUNDRY_CONTRACT_ENVELOPE_PROVIDER=<provider>`, map provider envelope events into `/api/operations/contract-envelopes`, and verify the matching contract certificate includes provider envelope evidence.
5. Confirm `/admin/operations` shows fresh rows for backup runs, scanner results, digest runs, trust-verification events, contract envelope events, operational events, and restore-drill results.
6. Keep the actual backup artifacts, completed-provider PDFs, and scanner quarantine outside the repo and outside public web roots.

Stage 4: Supabase persistence cutover
1. Apply all SQL migrations in `back-end/supabase/migrations/` to a staging Supabase project first.
2. Confirm `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SESSION_SIGNING_SECRET` are available from the host/Vault env used by the app.
3. Start a staging or maintenance app process with `NUXT_PUBLIC_BACKEND_MODE=supabase`.
4. Create the first real user through the normal account path.
5. Run the checked-in first-admin bootstrap script with `BOOTSTRAP_ADMIN_EMAIL` or `BOOTSTRAP_ADMIN_USER_ID`.
6. Verify the user row, admin role, and `admin_actions` bootstrap audit row.
7. Verify RLS and server-side ownership by testing non-admin access to another user's private workspace, files, proposals, and admin routes.
8. Confirm `/admin/readiness` reports active admin access and first-admin bootstrap evidence before switching the public process to Supabase mode.

Stage 5: OAuth or external auth provider
1. Register only the intended OAuth providers and callback URLs.
2. Add provider client secrets to Vault/host env only.
3. Keep `COFOUNDRY_OAUTH_PROVIDER`, `COFOUNDRY_GOOGLE_OAUTH_PROVIDER`, and `COFOUNDRY_GITHUB_OAUTH_PROVIDER` unset until Supabase mode is active for the staging process and the provider callback URL includes `/api/auth/oauth/callback`.
4. Set only the selected provider marker, restart the app process, and confirm `/auth/sign-in` shows only the selected provider button.
5. Verify new account creation, existing account linking, suspended-user rejection, session expiration, sign-out, and admin role rehydration.
6. Confirm `/admin/operations` records `auth.oauth.signed_in` and `/admin/readiness` shows the external-auth provider check passing after the smoke sign-in.
7. Keep unsupported providers blocked with the existing 501/400 responses.
8. Confirm `/auth/recover` remains available as an operator-mediated fallback.

Stage 6: Stripe billing
1. Create Stripe products/prices for the intended production plans.
2. Configure public publishable/price ids in normal env and server-only `STRIPE_SECRET_KEY` plus `STRIPE_WEBHOOK_SECRET` in Vault/host env.
3. Register the webhook URL for checkout and subscription lifecycle events.
4. Configure the Stripe Customer Portal before exposing self-service plan management.
5. Test checkout, webhook signature verification, subscription sync, plan downgrade/cancel behavior, and customer-portal access in staging.
6. Confirm `/admin/operations` shows a recent `stripe.webhook.processed` row and `/admin/readiness` shows Stripe webhook evidence passing after a signed checkout or subscription webhook.
7. Only set `NUXT_PUBLIC_BILLING_MODE=stripe` on production after staging proves subscription state, entitlements, readiness evidence, and rollback.

Final verification:
- Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run audit`, and `npm run build` against the release source if the server environment permits.
- Run `npm run verify:analytics` after `npm run build` to confirm the production analytics trackers are present in the built Nuxt output.
- Run `npm run verify:production` after `npm run build` to verify the built Nitro server returns expected health, health HEAD behavior, deployment identity, production security headers including HSTS, no localhost leaks in public metadata, canonical robots/sitemap/security.txt URLs, unknown-route 404, admin access control, private-surface no-store/noindex response policy, readiness metadata, public-form honeypot handling, intake-quality rejection, and contact-mail graceful degradation.
- Run `npm run verify:public:local` after `npm run build` to verify the built Nitro server returns coherent sitemap-listed public routes, same-origin public links, public SEO/security metadata, private-route redirects, private-surface no-store/noindex response policy, robots/sitemap, and `/.well-known/security.txt` before deploy.
- Run `npm run a11y:production` after `npm run build` to verify the built public shell passes axe smoke checks in light and dark mode.
- Run `VERIFY_PUBLIC_EXPECT_RELEASE=<release> VERIFY_PUBLIC_EXPECT_COMMIT_SHA=<commit> npm run verify:public` after deploy to verify the public origin returns the intended deployment identity, sitemap-listed public routes, same-origin public links, security headers, health mode, private-route access control, noindex behavior, canonical robots/sitemap URLs, and `/.well-known/security.txt`. If the host exposes only one identity field, set that one or use `VERIFY_PUBLIC_REQUIRE_DEPLOYMENT_IDENTITY=true`. If it reports local URLs in public output, redeploy the validated release, restart the service, and confirm `NUXT_PUBLIC_APP_URL` is the canonical HTTPS origin in the service environment.
- Trigger the GitHub live-origin workflow after deploy if a GitHub token/CLI is available. Prefer the checked-in dispatcher when `GITHUB_TOKEN` or `GH_TOKEN` is present: `npm run verify:public:dispatch -- --expected-release <release> --expected-commit-sha <commit>`. Preview the payload first with `npm run verify:public:dispatch -- --dry-run --expected-release <release> --expected-commit-sha <commit>`. If the GitHub CLI is already installed, the equivalent manual trigger is `gh workflow run public-site-verification.yml -R anderson-webops/cofoundry.jacobdanderson.net -f base_url=https://cofoundry.jacobdanderson.net -f expected_release=<release> -f expected_commit_sha=<commit> -f require_deployment_identity=true`.
- Verify production logs do not mention loading `../.env`.
- Verify `/api/health` and `/admin/readiness` show the deployed release tag or commit SHA.
- Verify public marketing pages remain indexable and private/app/admin/auth/email utility pages remain `noindex`.
- Verify `/admin/readiness` has no failed checks and only intentional warnings.
- Record the release tag, migration state, env source, timer names, backup location, restore-drill result, Stripe webhook id, OAuth app ids, and rollback command in the server runbook.
```
