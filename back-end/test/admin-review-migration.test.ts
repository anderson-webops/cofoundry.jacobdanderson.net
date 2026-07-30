import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const migrationPath = resolve(
  import.meta.dirname,
  "../supabase/migrations/20260729131000_admin_review_atomicity.sql",
)

test("opportunity review is revision-checked, atomic, and service-role-only", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /create or replace function public\.cofoundry_review_opportunity/i)
  assert.match(sql, /from public\.startup_opportunities[\s\S]*for update/i)
  assert.match(sql, /updated_at is distinct from p_expected_updated_at/i)
  assert.match(sql, /not actor_row\.verified_email/i)
  assert.match(sql, /update public\.startup_opportunities[\s\S]*insert into public\.admin_actions/i)
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i)
  assert.match(sql, /revoke all on function public\.cofoundry_review_opportunity[\s\S]*from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.cofoundry_review_opportunity[\s\S]*to service_role/i)
})
