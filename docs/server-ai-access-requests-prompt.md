# Server AI Prompt: Access Requests And Invites

Use this prompt for the server agent after deploying the current CoFoundry app changes.

```text
Configure CoFoundry's mock/access-request production mode for durable access requests and invite-only local accounts. Keep Supabase and Stripe disabled.

Current app behavior:
- Public `/auth/sign-up` submits workspace access requests when the backend remains in mock mode.
- Admins review requests at `/admin/access-requests`.
- Admin invite generation creates 30-day invite links for `/auth/sign-up?invite=...&email=...`.
- Invited member workspace state and collaboration workflow updates are stored locally so profile, inbox, billing preview, intro, message, proposal, and agreement state can survive restarts before Supabase is enabled.
- Admin moderation, role, report, privacy-request, and notification overlays are stored locally so `/admin/audit` remains durable in mock mode.
- Invited accounts are stored locally so sign-in persists across Node process restarts.
- The same access-request server utility is Supabase-ready, but production should stay in mock mode until the operator intentionally applies migrations and flips the backend mode.

Please configure the host/runtime:
1. Keep `NUXT_PUBLIC_BACKEND_MODE=mock` and `NUXT_PUBLIC_BILLING_MODE=mock`.
2. Keep `NUXT_PUBLIC_ENABLE_DEMO_ACCESS=false` for the production-facing site.
3. Verify paid-plan changes route to the CoFoundry team instead of granting paid entitlements when Stripe is not enabled.
4. Set `SESSION_SIGNING_SECRET` to a long random server-only value from Vault/host env.
5. Set `COFOUNDRY_LOCAL_DATA_DIR` to a durable writable host path owned by the app user.
6. Optionally set `COFOUNDRY_ACCESS_REQUEST_RETENTION_LIMIT` for the request queue, `COFOUNDRY_COLLABORATION_RETENTION_LIMIT` for local workflow rows, and `COFOUNDRY_ADMIN_AUDIT_RETENTION_LIMIT` for local admin audit rows.
7. Verify the app user can create and update:
   - `access-requests.json`
   - `member-workspace-state.json`
   - `collaboration-state.json`
   - `admin-audit.json`
   - `local-auth-accounts.json`
   - `operations-telemetry.json`
8. Keep these files off public web roots and out of git backups that are not intended to carry operational data.
9. Restart the Nuxt service using its configured production command and host-provided env only; do not add `../.env` loading to production startup.
10. Smoke test:
   - Submit a public access request.
   - Sign in as an admin.
   - Open `/admin/access-requests`.
   - Approve and issue an invite.
   - Open `/admin/audit` and confirm the access/admin action history is visible after a reload.
   - Open the invite link in a fresh browser session and create the invited account.
   - Update the invited account profile and verify paid-plan changes route to the CoFoundry team while Stripe is disabled.
   - Restart the app and verify the invited account can still sign in, the profile state remains, and the audit row still appears.
```

For later Supabase mode only, apply all migrations including `back-end/supabase/migrations/20260509120000_access_requests.sql` before setting `NUXT_PUBLIC_BACKEND_MODE=supabase`. Do not enable Supabase or Stripe until the server-side Supabase schema, auth bootstrap, billing webhooks, and Vault-injected secrets are intentionally provisioned.
