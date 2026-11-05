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

  it.each([
    {
      name: "a missing count",
      count: null,
      data: [],
      message: "count is unavailable"
    },
    {
      name: "an invalid count",
      count: Number.NaN,
      data: [],
      message: "count is unavailable"
    },
    {
      name: "a negative count",
      count: -1,
      data: [],
      message: "count is unavailable"
    },
    {
      name: "a fractional count",
      count: 1.5,
      data: [],
      message: "count is unavailable"
    },
    {
      name: "an incomplete empty page",
      count: 1,
      data: [],
      message: "page is incomplete"
    },
    {
      name: "an oversized page",
      count: 251,
      data: Array.from({ length: 251 }, (_, index) => ({ id: `version_${index}` })),
      message: "page is incomplete",
    },
    {
      name: "too many rows for the count",
      count: 1,
      data: [
        { id: "first" },
        { id: "second" }
      ],
      message: "exceeds the expected count",
    },
    {
      name: "duplicate IDs within one page",
      count: 2,
      data: [
        { id: "first" },
        { id: "first" }
      ],
      message: "changed during loading",
    },
  ])("rejects $name", async ({ count, data, message }) => {
    await expect(collectStablePages(async () => ({ count, data, error: null }))).rejects.toThrow(message)
  })

  it("preserves the provider's exact failure", async () => {
    const failure = new Error("Synthetic provider failure")
    await expect(collectStablePages(async () => ({ count: 0, data: [], error: failure }))).rejects.toBe(failure)
  })
})
