import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const migrationPath = resolve(
  import.meta.dirname,
  "../supabase/migrations/20260729120000_security_boundary_hardening.sql",
)

test("security migration closes direct public data access and removes plaintext auth rows", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /drop table if exists public\.demo_auth_accounts/i)
  assert.match(sql, /update storage\.buckets[\s\S]*public = false/i)
  assert.match(sql, /file_size_limit = 10485760/i)
  assert.match(sql, /allowed_mime_types/i)
  assert.match(sql, /where id = 'cofoundry-private-files'/i)
  assert.match(sql, /force row level security/i)
  assert.match(sql, /revoke all on schema public from public, anon, authenticated/i)
  assert.match(sql, /revoke all on all tables in schema public from public, anon, authenticated/i)
  assert.match(sql, /revoke all on all functions in schema public from public, anon, authenticated/i)
  assert.match(sql, /alter default privileges in schema public revoke all on tables from public, anon, authenticated/i)
  assert.match(sql, /alter default privileges in schema public revoke all on functions from public, anon, authenticated/i)
})

test("security migration makes admin changes atomic and service-role-only", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /cofoundry_apply_admin_security_action/i)
  assert.match(sql, /actor_row\.role <> 'admin'/i)
  assert.match(sql, /not actor_row\.verified_email/i)
  assert.match(sql, /where role = 'admin' and suspended_at is null and verified_email[\s\S]*active_full_admin_count/i)
  assert.match(sql, /not target_row\.verified_email[\s\S]*granting a privileged role/i)
  assert.match(sql, /not target_row\.verified_email[\s\S]*reinstating a privileged role/i)
  assert.match(sql, /last active full admin cannot be (?:demoted|suspended)/i)
  assert.match(sql, /grant execute on function public\.cofoundry_apply_admin_security_action.*to service_role/is)
  assert.match(sql, /pg_advisory_xact_lock[\s\S]*cofoundry:first-admin-bootstrap/i)
  assert.match(sql, /p_action_id !~ '\^\[0-9a-f\]\{8\}-/i)
  assert.match(sql, /p_created_at is null/i)
  assert.match(sql, /length\(pg_catalog\.btrim\(p_notes\)\) > 1000/i)
  assert.match(sql, /if not target_row\.verified_email[\s\S]*verified email address/i)
  assert.match(sql, /revoke all on function public\.cofoundry_apply_admin_security_action.*from public, anon, authenticated/is)
  assert.match(sql, /cofoundry_bootstrap_first_admin/i)
})
