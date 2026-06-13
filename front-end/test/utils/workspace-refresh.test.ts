import { describe, expect, it } from "vitest"
import { shouldRunWorkspaceRefresh } from "../../shared/utils/workspace-refresh"

const baseInput = {
  hasSession: true,
  isOnline: true,
  isVisible: true,
  lastStartedAtMs: null,
  minIntervalMs: 10_000,
  nowMs: 20_000,
  reason: "interval" as const,
  refreshPending: false,
}

describe("workspace refresh policy", () => {
  it("allows visible online sessions to refresh", () => {
    expect(shouldRunWorkspaceRefresh(baseInput)).toBe(true)
  })

  it("blocks anonymous, offline, hidden, and already pending refreshes", () => {
    expect(shouldRunWorkspaceRefresh({ ...baseInput, hasSession: false })).toBe(false)
    expect(shouldRunWorkspaceRefresh({ ...baseInput, isOnline: false })).toBe(false)
    expect(shouldRunWorkspaceRefresh({ ...baseInput, isVisible: false })).toBe(false)
    expect(shouldRunWorkspaceRefresh({ ...baseInput, refreshPending: true })).toBe(false)
  })

  it("allows manual refresh while hidden but still respects online and throttle state", () => {
    expect(shouldRunWorkspaceRefresh({ ...baseInput, isVisible: false, reason: "manual" })).toBe(true)
    expect(shouldRunWorkspaceRefresh({ ...baseInput, isOnline: false, reason: "manual" })).toBe(false)
    expect(shouldRunWorkspaceRefresh({ ...baseInput, lastStartedAtMs: 15_000, reason: "manual" })).toBe(false)
  })

  it("throttles repeated automatic refresh attempts", () => {
    expect(shouldRunWorkspaceRefresh({ ...baseInput, lastStartedAtMs: 5_000 })).toBe(true)
    expect(shouldRunWorkspaceRefresh({ ...baseInput, lastStartedAtMs: 15_000 })).toBe(false)
  })
})
