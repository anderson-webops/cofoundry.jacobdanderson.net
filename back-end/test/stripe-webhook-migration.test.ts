import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

const migrationPath = resolve(
  import.meta.dirname,
  "../supabase/migrations/20260729125000_stripe_webhook_ordering.sql",
)

test("Stripe reconciliation rejects duplicate and stale events atomically", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /stripe_last_event_created_at/i)
  assert.match(sql, /stripe_last_event_id/i)
  assert.match(sql, /subscriptions_stripe_checkout_session_unique_idx/i)
  assert.match(sql, /create or replace function public\.cofoundry_record_stripe_checkout_session/i)
  assert.match(sql, /stripe checkout session is already bound to another account/i)
  assert.match(sql, /stripe customer is already bound to another account/i)
  assert.match(sql, /for update/i)
  assert.match(sql, /reason', 'duplicate'/i)
  assert.match(sql, /reason', 'stale'/i)
  assert.match(sql, /stripe customer identity does not match/i)
  assert.match(sql, /revoke all on function public\.cofoundry_record_stripe_checkout_session[\s\S]*from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.cofoundry_record_stripe_checkout_session[\s\S]*to service_role/i)
  assert.match(sql, /revoke all on function public\.cofoundry_apply_stripe_subscription_event[\s\S]*from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.cofoundry_apply_stripe_subscription_event[\s\S]*to service_role/i)
})
