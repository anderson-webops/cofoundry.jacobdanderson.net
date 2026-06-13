export type WorkspaceRefreshReason = "interval" | "manual" | "online" | "visibility"

export interface WorkspaceRefreshPolicyInput {
  hasSession: boolean
  isOnline: boolean
  isVisible: boolean
  lastStartedAtMs: number | null
  minIntervalMs: number
  nowMs: number
  reason: WorkspaceRefreshReason
  refreshPending: boolean
}

export function shouldRunWorkspaceRefresh(input: WorkspaceRefreshPolicyInput) {
  if (!input.hasSession || input.refreshPending || !input.isOnline)
    return false

  if (input.reason !== "manual" && !input.isVisible)
    return false

  if (input.lastStartedAtMs !== null && input.nowMs - input.lastStartedAtMs < input.minIntervalMs)
    return false

  return true
}
