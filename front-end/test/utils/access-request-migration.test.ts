import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"
import { describe, expect, it } from "vitest"

describe("access request Supabase migration", () => {
  it("defines the invite queue table and admin-only policies", async () => {
    const sql = await readFile(resolve(process.cwd(), "../back-end/supabase/migrations/20260509120000_access_requests.sql"), "utf-8")

    expect(sql).toContain("create table if not exists public.access_requests")
    expect(sql).toContain("invite_token_hash text unique")
    expect(sql).toContain("access_requests_admin_select")
    expect(sql).toContain("access_requests_admin_update")
  })
})
