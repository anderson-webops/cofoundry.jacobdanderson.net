import type {
  InvestmentReviewerMutation,
  InvestmentReviewerSnapshot,
  InvestmentWorkspaceDocument,
} from "~/shared/types/investment-workspaces"
import { acceptHMRUpdate, defineStore } from "pinia"

export const useInvestmentReviewStore = defineStore("investment-review", () => {
  const { session } = useSessionState()
  const snapshot = ref<InvestmentReviewerSnapshot>({
    fileUploads: [],
    reviewers: [],
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
      const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined
      snapshot.value = await $fetch<InvestmentReviewerSnapshot>("/api/investment-review/workspaces", { headers })
      loadedUserId.value = session.value.id
      lastSyncedAt.value = new Date().toISOString()
      return snapshot.value
    }
    finally {
      loading.value = false
    }
  }

  async function loadCase(workspaceId: string, force = false) {
    if (!force) {
      const existing = snapshot.value.workspaces.find(item => item.id === workspaceId)
      if (existing)
        return existing
    }
    const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined
    const response = await $fetch<{
      fileUploads: InvestmentReviewerSnapshot["fileUploads"]
      reviewers: InvestmentReviewerSnapshot["reviewers"]
      supplementalTermsVersion: string
      workspace: InvestmentWorkspaceDocument
    }>(`/api/investment-review/workspaces/${workspaceId}`, { headers })
    snapshot.value.reviewers = response.reviewers
    snapshot.value.fileUploads = [
      ...response.fileUploads,
      ...snapshot.value.fileUploads.filter(item => !response.fileUploads.some(upload => upload.id === item.id)),
    ]
    snapshot.value.supplementalTermsVersion = response.supplementalTermsVersion
    snapshot.value.workspaces = [
      response.workspace,
      ...snapshot.value.workspaces.filter(item => item.id !== response.workspace.id),
    ]
    loadedUserId.value = session.value?.id || ""
    lastSyncedAt.value = new Date().toISOString()
    return response.workspace
  }

  async function mutate(workspace: InvestmentWorkspaceDocument, mutation: InvestmentReviewerMutation) {
    const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined
    const response = await $fetch<{ workspace: InvestmentWorkspaceDocument }>(`/api/investment-review/workspaces/${workspace.id}/mutations`, {
      body: {
        expectedVersion: workspace.version,
        mutation,
      },
      headers,
      method: "POST",
    })
    snapshot.value.workspaces = snapshot.value.workspaces.map(item => item.id === response.workspace.id ? response.workspace : item)
    lastSyncedAt.value = new Date().toISOString()
    return response.workspace
  }

  function reset() {
    snapshot.value = { fileUploads: [], reviewers: [], supplementalTermsVersion: "", workspaces: [] }
    loadedUserId.value = ""
    lastSyncedAt.value = null
  }

  watch(() => session.value?.id, (userId, previousUserId) => {
    if (userId !== previousUserId)
      reset()
  })

  return {
    lastSyncedAt,
    load,
    loadCase,
    loadedUserId,
    loading,
    mutate,
    reset,
    snapshot,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useInvestmentReviewStore, import.meta.hot))
