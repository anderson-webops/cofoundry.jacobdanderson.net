import type {
  InvestmentApplicantMutation,
  InvestmentApplicantSnapshot,
  InvestmentWorkspaceDocument,
} from "~/shared/types/investment-workspaces"
import { acceptHMRUpdate, defineStore } from "pinia"
import { ref, watch } from "vue"
import { useRequestHeaders } from "#app"
import { $fetch } from "#build/fetch"
import { useSessionState } from "~/composables/useSessionState"

export const useInvestmentWorkspaceStore = defineStore("investment-workspaces", () => {
  const { session } = useSessionState()
  const snapshot = ref<InvestmentApplicantSnapshot>({
    fileUploads: [],
    supplementalTermsVersion: "",
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
      const headers = import.meta.server
        ? useRequestHeaders(["cookie"])
        : undefined
      snapshot.value = await $fetch<InvestmentApplicantSnapshot>("/api/investment/workspaces", { headers })
      loadedUserId.value = session.value.id
      lastSyncedAt.value = new Date().toISOString()
      return snapshot.value
    }
    finally {
      loading.value = false
    }
  }

  async function create(payload: { opportunityId: string, organizationId: string | null }) {
    const headers = import.meta.server
      ? useRequestHeaders(["cookie"])
      : undefined
    const response = await $fetch<{ workspace: InvestmentWorkspaceDocument }>("/api/investment/workspaces", {
      body: payload,
      headers,
      method: "POST",
    })
    snapshot.value.workspaces = [
      response.workspace,
      ...snapshot.value.workspaces.filter(item => item.id !== response.workspace.id),
    ]
    lastSyncedAt.value = new Date().toISOString()
    return response.workspace
  }

  async function mutate(workspace: InvestmentWorkspaceDocument, mutation: InvestmentApplicantMutation) {
    const headers = import.meta.server
      ? useRequestHeaders(["cookie"])
      : undefined
    const response = await $fetch<{ workspace: InvestmentWorkspaceDocument }>(`/api/investment/workspaces/${workspace.id}/mutations`, {
      body: {
        expectedVersion: workspace.version,
        mutation,
      },
      headers,
      method: "POST",
    })
    snapshot.value.workspaces = snapshot.value.workspaces.map(item => item.id === response.workspace.id
      ? response.workspace
      : item)
    lastSyncedAt.value = new Date().toISOString()
    return response.workspace
  }

  function reset() {
    snapshot.value = { fileUploads: [], supplementalTermsVersion: "", workspaces: [] }
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
  import.meta.hot.accept(acceptHMRUpdate(useInvestmentWorkspaceStore, import.meta.hot))
