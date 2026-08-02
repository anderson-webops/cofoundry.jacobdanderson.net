# Server AI Prompt: Live Deploy Catch-Up

Use this prompt when source validation has passed locally but the public origin or hosted CI is behind the validated release. Keep this separate from provider cutover work: this is only for redeploying the current safe mock/access-request production path and restoring verification signal.

Render a paste-ready prompt for the current release with:

```sh
npm run server:prompt:live-deploy
```

Use `--release`, `--commit-sha`, `--deployed-at`, or `--public-origin` when rendering a prompt for a host that differs from the current checkout or default public origin.

```text
You are catching CoFoundry's production host up to the latest validated release.

Current intent:
- Keep production in mock/access-request mode.
- Do not enable Supabase, Stripe, OAuth, outbound mail, or provider webhooks.
- Do not add dotenv or dotenvx loading to production startup. Production must use host process env only.
- Do not commit or print secrets.

Validated release:
- Release tag: <release-tag>
- Commit SHA: <commit-sha>
- Public origin: <public-origin>

Tasks:
1. Confirm the host checkout or deployment artifact is exactly `<commit-sha>` from `<release-tag>`.
2. Confirm `node --version` is `v24.18.1` and `npm --version` is `12.0.2`, then run `npm run verify:release:local` from the release source. Root `devEngines` must reject any mismatch. If npm reports an unknown `global-ignore-file` environment configuration, stop and align the deployment runner on npm 12.0.2 instead of suppressing the warning. Do not fall back to `npm install` for deploy readiness. If server resources make the full gate impractical, run the individual commands from the release notes and document the omission.
3. Build from the release source with `npm run build` if the full release gate was not already run on this host.
4. Confirm the production service starts from the built output with the existing production command. Do not introduce `../.env` loading in production startup.
5. Confirm host env keeps:
   - `NODE_ENV=production`
   - `NUXT_PUBLIC_APP_URL=<public-origin>`
   - `NUXT_PUBLIC_BACKEND_MODE=mock`
   - `NUXT_PUBLIC_BILLING_MODE=mock`
   - `NUXT_PUBLIC_ENABLE_DEMO_ACCESS=false`
6. Set or refresh non-secret deployment identity in the production service env:
   - `COFOUNDRY_RELEASE=<release-tag>`
   - `COFOUNDRY_COMMIT_SHA=<commit-sha>`
   - `COFOUNDRY_DEPLOYED_AT=<current ISO timestamp>`
7. Run `npm run verify:host-env -- --production` from the same host environment that will launch the app. Resolve any failed checks before restart.
8. Keep these unset unless a later explicit provider cutover is authorized:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - OAuth provider markers
   - mail provider credentials
9. Restart the production app service.
10. Verify production logs do not mention loading `../.env`.
11. Verify `/api/health` exposes at least `release=<release-tag>` or `commit=<commit-sha>`.
12. Run:

   VERIFY_PUBLIC_BASE_URL=<public-origin> VERIFY_PUBLIC_EXPECT_RELEASE=<release-tag> VERIFY_PUBLIC_EXPECT_COMMIT_SHA=<commit-sha> npm run verify:public

13. If GitHub Actions is available again, run:

   npm run verify:github-actions

   If it fails with runner-start failures and no job steps, fix GitHub account billing, Actions spending limits, Actions enablement, or runner availability rather than changing application source.
14. If a GitHub token is available after deploy, trigger the live-origin verification workflow:

   npm run verify:public:dispatch -- --dry-run --expected-release <release-tag> --expected-commit-sha <commit-sha>
   GITHUB_TOKEN=<token> npm run verify:public:dispatch -- --expected-release <release-tag> --expected-commit-sha <commit-sha>

Expected end state:
- Public `/api/health` identifies the deployed release or commit.
- `npm run verify:public` passes for the production origin.
- GitHub hosted CI jobs start normally, or any failure is a real source/test failure with job steps and logs.
- Supabase and Stripe remain disabled.
```
