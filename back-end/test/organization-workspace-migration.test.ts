import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const migrationPath = resolve(
  import.meta.dirname,
  "../supabase/migrations/20260808160000_organization_workspace_documents.sql",
)

test("organization workspace documents are CAS-versioned and service-role only", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /create table if not exists public\.organization_workspace_documents/i)
  assert.match(sql, /owner_user_id text not null references public\.users\(id\) on delete restrict/i)
  assert.match(sql, /active_member_user_ids text\[\] not null/i)
  assert.match(sql, /pending_invite_emails text\[\] not null/i)
  assert.match(sql, /linked_resource_keys text\[\] not null/i)
  assert.match(sql, /document jsonb not null/i)
  assert.match(sql, /version integer not null default 1/i)
  assert.match(sql, /owner_user_id = any\(active_member_user_ids\)/i)
  assert.match(sql, /using gin \(active_member_user_ids\)/i)
  assert.match(sql, /using gin \(pending_invite_emails\)/i)
  assert.match(sql, /using gin \(linked_resource_keys\)/i)
  assert.match(sql, /alter table public\.organization_workspace_documents enable row level security/i)
  assert.match(sql, /revoke all on table public\.organization_workspace_documents from public, anon, authenticated/i)
  assert.match(sql, /grant select, insert, update, delete on table public\.organization_workspace_documents to service_role/i)
})
