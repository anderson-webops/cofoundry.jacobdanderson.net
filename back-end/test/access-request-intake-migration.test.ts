import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const migrationPath = resolve(
  import.meta.dirname,
  "../supabase/migrations/20260729135000_access_request_intake_atomicity.sql",
)

test("access-request intake is serialized, deduplicated, and service-role-only", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /create or replace function public\.cofoundry_create_access_request/i)
  assert.match(sql, /pg_advisory_xact_lock[\s\S]*cofoundry:access-request:/i)
  assert.match(sql, /lower\(pg_catalog\.btrim\(email\)\) = normalized_email/i)
  assert.match(sql, /status <> 'denied'[\s\S]*invite_accepted_at is null/i)
  assert.match(sql, /limit 1[\s\S]*for update/i)
  assert.match(sql, /'created', false[\s\S]*to_jsonb\(request_row\)/i)
  assert.match(sql, /insert into public\.access_requests[\s\S]*'created', true/i)
  assert.match(sql, /revoke all on function public\.cofoundry_create_access_request[\s\S]*from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.cofoundry_create_access_request[\s\S]*to service_role/i)
})
