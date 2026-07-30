import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const migrationPath = resolve(
  import.meta.dirname,
  "../supabase/migrations/20260729133000_signup_and_submission_atomicity.sql",
)

test("invite signup and investment submission are atomic and service-role-only", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /create or replace function public\.cofoundry_accept_access_invite_and_replace_member_workspace/i)
  assert.match(sql, /from public\.access_requests[\s\S]*for update/i)
  assert.match(sql, /cofoundry_replace_member_workspace[\s\S]*update public\.access_requests/i)
  assert.match(sql, /invite_expires_at < p_accepted_at/i)
  assert.match(sql, /invite_token_hash = null/i)
  assert.match(sql, /create unique index[\s\S]*investment_applications_one_active_per_opportunity_idx/i)
  assert.match(sql, /create or replace function public\.cofoundry_submit_investment_application/i)
  assert.match(sql, /from public\.startup_opportunities[\s\S]*for update/i)
  assert.match(sql, /owner_user_id <> p_applicant_user_id/i)
  assert.match(sql, /status <> 'declined'/i)

  for (const functionName of [
    "cofoundry_accept_access_invite_and_replace_member_workspace",
    "cofoundry_submit_investment_application",
  ]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${functionName}[\\s\\S]*from public, anon, authenticated`, "i"))
    assert.match(sql, new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]*to service_role`, "i"))
  }
})
