import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const migrationPath = resolve(
  import.meta.dirname,
  "../supabase/migrations/20260729130000_collaboration_atomicity.sql",
)

test("collaboration transitions upsert atomically without destructive replacement", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /create or replace function public\.cofoundry_upsert_collaboration_state/i)
  assert.match(sql, /pg_advisory_xact_lock/i)
  assert.match(sql, /expected_exists/i)
  assert.match(sql, /collaboration state changed after this action began/i)
  assert.match(sql, /current_row\.unread_count_by_user is distinct from incoming\.expected_unread_count_by_user/i)
  assert.match(sql, /current_row\.current_version_id is distinct from incoming\.expected_current_version_id/i)
  assert.match(sql, /proposal_versions_number_unique_idx/i)
  assert.match(sql, /contracts_proposal_unique_idx/i)
  assert.match(sql, /trial_collaborations_match_unique_idx/i)
  assert.match(sql, /insert into public\.conversations[\s\S]*insert into public\.matches/i)
  assert.match(sql, /insert into public\.proposals[\s\S]*insert into public\.proposal_versions/i)
  assert.match(sql, /insert into public\.contracts[\s\S]*insert into public\.contract_versions/i)
  assert.match(sql, /signatures_contract_version_user_unique_idx/i)
  assert.match(sql, /insert into public\.contract_signature_events/i)
  assert.match(sql, /insert into public\.messages[\s\S]*on conflict \(id\) do nothing/i)
  assert.match(sql, /insert into public\.proposal_versions[\s\S]*on conflict \(id\) do nothing/i)
  assert.match(sql, /insert into public\.contract_versions[\s\S]*on conflict \(id\) do nothing/i)
  assert.doesNotMatch(sql, /delete from public\.(?:conversations|matches|messages|proposals|contracts)/i)
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i)
  assert.match(sql, /revoke all on function public\.cofoundry_upsert_collaboration_state[\s\S]*from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.cofoundry_upsert_collaboration_state[\s\S]*to service_role/i)
})
