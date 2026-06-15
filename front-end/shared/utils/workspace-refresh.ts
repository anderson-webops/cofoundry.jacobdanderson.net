export type WorkspaceRefreshReason = "interval" | "manual" | "online" | "realtime" | "visibility"

export interface WorkspaceRealtimePolicyInput {
  enabled: boolean
  hasSession: boolean
  isClient: boolean
  supportsEventSource: boolean
}

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

  if (!["manual", "realtime"].includes(input.reason) && !input.isVisible)
    return false

  if (input.reason !== "realtime" && input.lastStartedAtMs !== null && input.nowMs - input.lastStartedAtMs < input.minIntervalMs)
    return false

  return true
}

export function shouldUseWorkspaceRealtime(input: WorkspaceRealtimePolicyInput) {
  return input.enabled && input.isClient && input.hasSession && input.supportsEventSource
}
