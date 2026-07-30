import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const migrationPath = resolve(
  import.meta.dirname,
  "../supabase/migrations/20260729134000_provider_event_idempotency.sql",
)

test("provider callback source ids are deduplicated and unique", async () => {
  const sql = await readFile(migrationPath, "utf8")

  for (const tableName of [
    "email_suppressions",
    "contract_provider_events",
    "trust_verification_events",
  ]) {
    assert.match(sql, new RegExp(`partition by provider, source_event_id[\\s\\S]*delete from public\\.${tableName}`, "i"))
    assert.match(sql, new RegExp(`create unique index[\\s\\S]*on public\\.${tableName} \\(provider, source_event_id\\)`, "i"))
  }
})
