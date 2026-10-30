import { describe, expect, it } from "vitest"
import { collectStablePages } from "../../server/utils/supabase-pagination"

describe("supabase version history pagination", () => {
  it("loads every row despite a server response cap smaller than the requested page", async () => {
    const rows = Array.from({ length: 301 }, (_, index) => ({ id: `version_${index + 1}` }))
    const loaded = await collectStablePages(async (start, end) => ({
      count: rows.length,
      data: rows.slice(start, Math.min(end + 1, start + 100)),
      error: null,
    }))

    expect(loaded).toEqual(rows)
  })

  it("rejects a changing result set instead of returning incomplete history", async () => {
    const rows = Array.from({ length: 300 }, (_, index) => ({ id: `version_${index + 1}` }))
    await expect(collectStablePages(async (start, end) => ({
      count: start
        ? rows.length + 1
        : rows.length,
      data: rows.slice(start, end + 1),
      error: null,
    }))).rejects.toThrow("changed during loading")
  })

  it("rejects overlapping pages even when their row counts appear complete", async () => {
    const rows = Array.from({ length: 300 }, (_, index) => ({ id: `version_${index + 1}` }))
    await expect(collectStablePages(async (start, end) => ({
      count: rows.length,
      data: start
        ? rows.slice(start - 1, end)
        : rows.slice(start, end + 1),
      error: null,
    }))).rejects.toThrow("changed during loading")
  })

  it("returns an empty history without retrying", async () => {
    const loaded = await collectStablePages(async () => ({ count: 0, data: [], error: null }))
    expect(loaded).toEqual([])
  })
})
