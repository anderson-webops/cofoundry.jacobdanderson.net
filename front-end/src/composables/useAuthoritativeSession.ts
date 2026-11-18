import type { SessionUser } from "~/shared/types/domain"
import { useRequestHeaders } from "#app"
import { $fetch } from "#build/fetch"
import { useSessionState } from "~/composables/useSessionState"
import { useWorkspaceStore } from "~/stores/workspace"

export async function useAuthoritativeSession() {
  const { setSession } = useSessionState()
  const workspaceStore = useWorkspaceStore()
  const headers = import.meta.server
    ? useRequestHeaders(["cookie"])
    : undefined
  const response = await $fetch<{ session: SessionUser | null }>("/api/auth/session", { headers })

  setSession(response.session)
  if (response.session)
    await workspaceStore.loadWorkspace(false, headers)
  else
    workspaceStore.resetSessionState()
  return response.session
}
