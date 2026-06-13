import type { WorkspaceRefreshReason } from "~/shared/utils/workspace-refresh"
import { shouldRunWorkspaceRefresh } from "~/shared/utils/workspace-refresh"

interface WorkspaceRealtimeRefreshOptions {
  intervalMs?: number
  minIntervalMs?: number
}

export function useWorkspaceRealtimeRefresh(options: WorkspaceRealtimeRefreshOptions = {}) {
  const workspaceStore = useWorkspaceStore()
  const { session } = useSessionState()
  const refreshPending = ref(false)
  const lastRefreshAttemptAt = ref<string | null>(null)
  const lastRefreshReason = ref<WorkspaceRefreshReason | null>(null)

  const intervalMs = options.intervalMs ?? 45_000
  const minIntervalMs = options.minIntervalMs ?? 10_000
  let intervalId: number | null = null
  let lastStartedAtMs: number | null = null

  function isVisible() {
    return typeof document === "undefined" || document.visibilityState === "visible"
  }

  function isOnline() {
    return typeof navigator === "undefined" || navigator.onLine
  }

  async function refreshWorkspace(reason: WorkspaceRefreshReason = "manual") {
    if (!import.meta.client)
      return false

    const nowMs = Date.now()
    if (!shouldRunWorkspaceRefresh({
      hasSession: Boolean(session.value),
      isOnline: isOnline(),
      isVisible: isVisible(),
      lastStartedAtMs,
      minIntervalMs,
      nowMs,
      reason,
      refreshPending: refreshPending.value,
    })) {
      return false
    }

    refreshPending.value = true
    lastStartedAtMs = nowMs
    lastRefreshReason.value = reason

    try {
      await workspaceStore.loadWorkspace(true)
      lastRefreshAttemptAt.value = new Date().toISOString()
      return true
    }
    catch {
      return false
    }
    finally {
      refreshPending.value = false
    }
  }

  if (import.meta.client) {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible")
        void refreshWorkspace("visibility")
    }

    const handleOnline = () => {
      void refreshWorkspace("online")
    }

    onMounted(() => {
      intervalId = window.setInterval(() => {
        void refreshWorkspace("interval")
      }, intervalMs)

      document.addEventListener("visibilitychange", handleVisibilityChange)
      window.addEventListener("online", handleOnline)
    })

    onBeforeUnmount(() => {
      if (intervalId)
        window.clearInterval(intervalId)

      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("online", handleOnline)
    })
  }

  return {
    lastRefreshAttemptAt,
    lastRefreshReason,
    refreshPending,
    refreshWorkspace,
  }
}
