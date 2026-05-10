# Server AI Prompt: First Admin Bootstrap

Use this when the host has Supabase provisioned but CoFoundry has not enabled live Supabase mode yet.

```
You are configuring CoFoundry first-admin provisioning on the production host.

Current application goal:
- Keep Supabase disabled until verification is complete.
- Use host/Vault-injected env only; do not read repo .env files in production.
- Promote one already-created CoFoundry user to admin through the checked-in bootstrap script.

Steps:
1. Confirm the target user already exists in the Supabase `users` table through the normal auth/account path.
2. Confirm all migrations in `back-end/supabase/migrations/` have been applied in timestamp order.
3. Confirm these env values are present in the shell or systemd/Vault environment used for the command:
   - `NUXT_PUBLIC_BACKEND_MODE=supabase`
   - `NUXT_PUBLIC_SUPABASE_URL`
   - `NUXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SIGNING_SECRET`
4. Run one of:
   - `BOOTSTRAP_ADMIN_EMAIL=operator@example.com npm run -w back-end bootstrap-admin`
   - `BOOTSTRAP_ADMIN_USER_ID=<cofoundry-user-id> npm run -w back-end bootstrap-admin`
5. Verify the script reports an admin action id.
6. Verify the target row in `users` now has `role='admin'` or the intended `BOOTSTRAP_ADMIN_ROLE`.
7. Verify `admin_actions` contains the bootstrap role-change audit row.
8. Restart the app with Supabase mode only after `/admin` access is verified in staging.

Do not enable Stripe. Do not commit any secret values. If the script fails because the target user is missing, create the user through the normal account path first instead of inserting a partial user row by hand.
```
