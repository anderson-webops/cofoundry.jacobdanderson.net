import type { WorkspaceRefreshReason } from "~/shared/utils/workspace-refresh"
import { shouldRunWorkspaceRefresh, shouldUseWorkspaceRealtime } from "~/shared/utils/workspace-refresh"

interface WorkspaceRealtimeRefreshOptions {
  enableRealtime?: boolean
  intervalMs?: number
  minIntervalMs?: number
}

type WorkspaceRealtimeStatus = "closed" | "connecting" | "fallback" | "open" | "unsupported"

export function useWorkspaceRealtimeRefresh(options: WorkspaceRealtimeRefreshOptions = {}) {
  const workspaceStore = useWorkspaceStore()
  const { session } = useSessionState()
  const refreshPending = ref(false)
  const lastRefreshAttemptAt = ref<string | null>(null)
  const lastRefreshReason = ref<WorkspaceRefreshReason | null>(null)
  const realtimeStatus = ref<WorkspaceRealtimeStatus>("closed")

  const intervalMs = options.intervalMs ?? 45_000
  const minIntervalMs = options.minIntervalMs ?? 10_000
  const enableRealtime = options.enableRealtime ?? true
  let intervalId: number | null = null
  let lastStartedAtMs: number | null = null
  let eventSource: EventSource | null = null

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

  function stopIntervalFallback() {
    if (intervalId) {
      window.clearInterval(intervalId)
      intervalId = null
    }
  }

  function startIntervalFallback() {
    if (intervalId)
      return

    intervalId = window.setInterval(() => {
      void refreshWorkspace("interval")
    }, intervalMs)
  }

  function closeRealtime() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }

  function connectRealtime() {
    if (!shouldUseWorkspaceRealtime({
      enabled: enableRealtime,
      hasSession: Boolean(session.value),
      isClient: import.meta.client,
      supportsEventSource: typeof EventSource !== "undefined",
    })) {
      realtimeStatus.value = typeof EventSource === "undefined" ? "unsupported" : "closed"
      closeRealtime()
      startIntervalFallback()
      return
    }

    if (eventSource)
      return

    realtimeStatus.value = "connecting"
    eventSource = new EventSource("/api/workspace/events")
    eventSource.addEventListener("open", () => {
      realtimeStatus.value = "open"
      stopIntervalFallback()
    })
    eventSource.addEventListener("workspace-change", () => {
      void refreshWorkspace("realtime")
    })
    eventSource.addEventListener("error", () => {
      realtimeStatus.value = "fallback"
      closeRealtime()
      startIntervalFallback()
    })
  }

  function reconnectRealtime() {
    closeRealtime()
    connectRealtime()
  }

  if (import.meta.client) {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!eventSource)
          connectRealtime()
        void refreshWorkspace("visibility")
      }
    }

    const handleOnline = () => {
      reconnectRealtime()
      void refreshWorkspace("online")
    }

    onMounted(() => {
      connectRealtime()

      document.addEventListener("visibilitychange", handleVisibilityChange)
      window.addEventListener("online", handleOnline)
    })

    onBeforeUnmount(() => {
      stopIntervalFallback()
      closeRealtime()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("online", handleOnline)
    })

    watch(() => session.value?.id || "", () => {
      reconnectRealtime()
    })
  }

  return {
    lastRefreshAttemptAt,
    lastRefreshReason,
    realtimeStatus,
    refreshPending,
    refreshWorkspace,
  }
}
