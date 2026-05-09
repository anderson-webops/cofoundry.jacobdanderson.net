# Server AI Prompt: Access Requests And Invites

Use this prompt for the server agent after deploying the current CoFoundry app changes.

```text
Configure CoFoundry's mock/access-request production mode for durable access requests and invite-only local accounts. Keep Supabase and Stripe disabled.

Current app behavior:
- Public `/auth/sign-up` submits workspace access requests when the backend remains in mock mode.
- Admins review requests at `/admin/access-requests`.
- Admin invite generation creates 30-day invite links for `/auth/sign-up?invite=...&email=...`.
- Invited accounts are stored locally so sign-in persists across Node process restarts.
- The same access-request server utility is Supabase-ready, but production should stay in mock mode until the operator intentionally applies migrations and flips the backend mode.

Please configure the host/runtime:
1. Keep `NUXT_PUBLIC_BACKEND_MODE=mock` and `NUXT_PUBLIC_BILLING_MODE=mock`.
2. Keep `NUXT_PUBLIC_ENABLE_DEMO_ACCESS=false` for the production-facing site.
3. Set `SESSION_SIGNING_SECRET` to a long random server-only value from Vault/host env.
4. Set `COFOUNDRY_LOCAL_DATA_DIR` to a durable writable host path owned by the app user.
5. Optionally set `COFOUNDRY_ACCESS_REQUEST_RETENTION_LIMIT` for the request queue.
6. Verify the app user can create and update:
   - `access-requests.json`
   - `local-auth-accounts.json`
   - `operations-telemetry.json`
7. Keep these files off public web roots and out of git backups that are not intended to carry operational data.
8. Restart the Nuxt service using its configured production command and host-provided env only; do not add `../.env` loading to production startup.
9. Smoke test:
   - Submit a public access request.
   - Sign in as an admin.
   - Open `/admin/access-requests`.
   - Approve and issue an invite.
   - Open the invite link in a fresh browser session and create the invited account.
   - Restart the app and verify the invited account can still sign in.
```

For later Supabase mode only, apply all migrations including `back-end/supabase/migrations/20260509120000_access_requests.sql` before setting `NUXT_PUBLIC_BACKEND_MODE=supabase`. Do not enable Supabase or Stripe until the server-side Supabase schema, auth bootstrap, billing webhooks, and Vault-injected secrets are intentionally provisioned.
