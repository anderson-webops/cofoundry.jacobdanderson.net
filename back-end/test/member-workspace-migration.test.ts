import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const migrationPath = resolve(
  import.meta.dirname,
  "../supabase/migrations/20260729123000_member_workspace_atomicity.sql",
)

test("member workspace persistence is one service-role-only transaction", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /create or replace function public\.cofoundry_replace_member_workspace/i)
  assert.match(sql, /delete from public\.bookmarks[\s\S]*insert into public\.bookmarks/i)
  assert.match(sql, /delete from public\.saved_searches[\s\S]*insert into public\.saved_searches/i)
  assert.match(sql, /delete from public\.startup_opportunities[\s\S]*insert into public\.startup_opportunities/i)
  assert.match(sql, /pg_advisory_xact_lock[\s\S]*cofoundry:member-workspace:/i)
  assert.match(sql, /when existing_user\.role in \('admin', 'investor_admin'\) then existing_user\.role/i)
  assert.match(sql, /case when row_data\.role in \('founder', 'collaborator'\) then row_data\.role else 'founder' end/i)
  assert.match(sql, /verified_email = existing_user\.verified_email or excluded\.verified_email/i)
  assert.match(sql, /suspended_at = existing_user\.suspended_at/i)
  assert.match(sql, /p_replace_subscription boolean default false/i)
  assert.match(sql, /case when p_replace_subscription then row_data\.plan else 'free' end/i)
  assert.match(sql, /case when p_replace_subscription then row_data\.visibility_boost else false end/i)
  assert.match(sql, /case when p_replace_subscription then row_data\.stripe_customer_id else null end/i)
  assert.match(sql, /case when p_replace_subscription then excluded\.plan else existing_subscription\.plan end/i)
  assert.match(sql, /Opportunity ids must remain owned by the same member/i)
  assert.match(sql, /verification_status = case[\s\S]*else existing_opportunity\.verification_status/i)
  assert.match(sql, /where existing_opportunity\.owner_user_id = workspace_user_id/i)
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i)
  assert.match(sql, /revoke all on function public\.cofoundry_replace_member_workspace[\s\S]*from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.cofoundry_replace_member_workspace[\s\S]*to service_role/i)
})
