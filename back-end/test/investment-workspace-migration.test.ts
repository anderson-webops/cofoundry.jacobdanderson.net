import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const migrationPath = resolve(
  import.meta.dirname,
  "../supabase/migrations/20260808170000_investment_workspace_documents.sql",
)

test("investment workspace documents are isolated, CAS-versioned, and service-role only", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /create table if not exists public\.investment_workspace_documents/i)
  assert.match(sql, /application_id text not null unique/i)
  assert.match(sql, /applicant_user_id text not null references public\.users\(id\) on delete cascade/i)
  assert.match(sql, /opportunity_id text not null references public\.startup_opportunities\(id\) on delete restrict/i)
  assert.match(sql, /all_file_upload_ids text\[\] not null/i)
  assert.match(sql, /shared_file_upload_ids text\[\] not null/i)
  assert.match(sql, /shared_file_upload_ids <@ all_file_upload_ids/i)
  assert.match(sql, /version integer not null default 1/i)
  assert.match(sql, /using gin \(all_file_upload_ids\)/i)
  assert.match(sql, /using gin \(shared_file_upload_ids\)/i)
  assert.match(sql, /alter table public\.investment_workspace_documents enable row level security/i)
  assert.match(sql, /revoke all on table public\.investment_workspace_documents from public, anon, authenticated/i)
  assert.match(sql, /grant select, insert, update, delete on table public\.investment_workspace_documents to service_role/i)
  assert.match(sql, /investment_document/i)
  assert.match(sql, /investment_workspace/i)
})
