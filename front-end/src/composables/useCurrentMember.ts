import { getProfileByUserId, getSubscriptionByUserId } from "~/shared/utils/workspace"

export function useCurrentMember() {
  const authStore = useAuthStore()
  const workspaceStore = useWorkspaceStore()

  const profile = computed(() => authStore.currentUser
    ? getProfileByUserId(workspaceStore.data, authStore.currentUser.id)
    : null)
  const subscription = computed(() => authStore.currentUser
    ? getSubscriptionByUserId(workspaceStore.data, authStore.currentUser.id)
    : null)

  return {
    authStore,
    profile,
    subscription,
    workspaceStore,
  }
}
