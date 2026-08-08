import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const migrationPath = resolve(
  import.meta.dirname,
  "../supabase/migrations/20260808120000_contract_legal_reviews.sql",
)

test("contract legal reviews are version-bound and service-role only", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /create table if not exists public\.contract_legal_reviews/i)
  assert.match(sql, /contract_id text not null references public\.contracts\(id\) on delete cascade/i)
  assert.match(sql, /contract_version_id text not null references public\.contract_versions\(id\) on delete cascade/i)
  assert.match(sql, /requested_by_user_id text not null references public\.users\(id\) on delete cascade/i)
  assert.match(sql, /cardinality\(review_scope\) between 1 and 6/i)
  assert.match(sql, /responded_by_name text/i)
  assert.match(sql, /contract_legal_reviews_active_reviewer_idx/i)
  assert.match(sql, /where status in \('requested', 'opened', 'changes_requested'\)/i)
  assert.match(sql, /alter table public\.contract_legal_reviews enable row level security/i)
  assert.match(sql, /revoke all on table public\.contract_legal_reviews from public, anon, authenticated/i)
  assert.match(sql, /grant all on table public\.contract_legal_reviews to service_role/i)
})
