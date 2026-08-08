import type { OrganizationMutation, OrganizationWorkspaceDocument, OrganizationWorkspaceSnapshot } from "~/shared/types/organizations"
import { acceptHMRUpdate, defineStore } from "pinia"

interface CreateOrganizationPayload {
  description: string
  kind: "startup_team" | "venture_studio"
  name: string
  website: string
}

export const useOrganizationStore = defineStore("organizations", () => {
  const { session } = useSessionState()
  const snapshot = ref<OrganizationWorkspaceSnapshot>({
    legalReviewQueue: [],
    workspaces: [],
  })
  const loading = ref(false)
  const loadedUserId = ref("")
  const lastSyncedAt = ref<string | null>(null)

  async function load(force = false) {
    if (!session.value)
      return snapshot.value
    if (!force && loadedUserId.value === session.value.id)
      return snapshot.value

    loading.value = true
    try {
      snapshot.value = await $fetch<OrganizationWorkspaceSnapshot>("/api/organizations")
      loadedUserId.value = session.value.id
      lastSyncedAt.value = new Date().toISOString()
      return snapshot.value
    }
    finally {
      loading.value = false
    }
  }

  async function create(payload: CreateOrganizationPayload) {
    const response = await $fetch<{ workspace: OrganizationWorkspaceDocument }>("/api/organizations", {
      body: payload,
      method: "POST",
    })
    snapshot.value.workspaces = [
      response.workspace,
      ...snapshot.value.workspaces.filter(item => item.organization.id !== response.workspace.organization.id),
    ]
    lastSyncedAt.value = new Date().toISOString()
    return response.workspace
  }

  async function mutate(workspace: OrganizationWorkspaceDocument, mutation: OrganizationMutation) {
    const response = await $fetch<{
      delivery: { delivered: boolean }
      workspace: OrganizationWorkspaceDocument
    }>(`/api/organizations/${workspace.organization.id}/mutations`, {
      body: {
        expectedVersion: workspace.version,
        mutation,
      },
      method: "POST",
    })
    snapshot.value.workspaces = snapshot.value.workspaces.map(item =>
      item.organization.id === response.workspace.organization.id ? response.workspace : item,
    )
    lastSyncedAt.value = new Date().toISOString()
    return response
  }

  function reset() {
    snapshot.value = { legalReviewQueue: [], workspaces: [] }
    loadedUserId.value = ""
    lastSyncedAt.value = null
  }

  watch(() => session.value?.id, (userId, previousUserId) => {
    if (userId !== previousUserId)
      reset()
  })

  return {
    create,
    lastSyncedAt,
    load,
    loadedUserId,
    loading,
    mutate,
    reset,
    snapshot,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useOrganizationStore, import.meta.hot))
