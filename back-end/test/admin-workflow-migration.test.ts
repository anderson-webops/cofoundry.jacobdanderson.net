import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const migrationPath = resolve(
  import.meta.dirname,
  "../supabase/migrations/20260729132000_admin_workflow_atomicity.sql",
)

test("admin case transitions are stale-checked, audited, and service-role-only", async () => {
  const sql = await readFile(migrationPath, "utf8")

  for (const functionName of [
    "cofoundry_apply_admin_report_action",
    "cofoundry_apply_admin_privacy_action",
    "cofoundry_apply_admin_access_status",
    "cofoundry_issue_admin_access_invite",
    "cofoundry_apply_admin_file_scan",
    "cofoundry_record_admin_queue_action",
  ]) {
    assert.match(sql, new RegExp(`create or replace function public\\.${functionName}`, "i"))
    assert.match(sql, new RegExp(`revoke all on function public\\.${functionName}[\\s\\S]*from public, anon, authenticated`, "i"))
    assert.match(sql, new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]*to service_role`, "i"))
  }

  assert.match(sql, /role = 'admin'[\s\S]*verified_email[\s\S]*suspended_at is null/i)
  assert.match(sql, /from public\.reports[\s\S]*for update[\s\S]*insert into public\.admin_actions/i)
  assert.match(sql, /from public\.privacy_requests[\s\S]*for update[\s\S]*insert into public\.admin_actions/i)
  assert.match(sql, /p_status = 'resolved' and p_completion_confirmed is not true/i)
  assert.match(sql, /'completionConfirmed', p_status = 'resolved' and p_completion_confirmed/i)
  assert.match(sql, /updated_at is distinct from p_expected_updated_at/i)
  assert.match(sql, /approve the access request before issuing an invite/i)
  assert.match(sql, /scan_status not in \('pending', 'failed', 'skipped'\)/i)
  assert.match(sql, /cofoundry_record_admin_queue_action[\s\S]*cofoundry_assert_full_admin/i)
  assert.match(sql, /p_action_type not in \('assign_case', 'escalate_case', 'review_evidence'\)/i)
})
