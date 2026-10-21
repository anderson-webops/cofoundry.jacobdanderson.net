import { buildInboxSnapshot } from "~/shared/utils/inbox"
import { getUnreadMessages } from "~/shared/utils/workspace"

export function useWorkspaceCounts() {
  const authStore = useAuthStore()
  const workspaceStore = useWorkspaceStore()

  const notificationCount = computed(() => workspaceStore.data.notifications.filter(notification => notification.userId === authStore.currentUser?.id && !notification.readAt).length)
  const unreadMessages = computed(() => authStore.currentUser?.id ? getUnreadMessages(workspaceStore.data, authStore.currentUser.id) : 0)
  const inboxActionCount = computed(() => authStore.currentUser?.id ? buildInboxSnapshot(workspaceStore.data, authStore.currentUser.id).actions.length : 0)

  return {
    inboxActionCount,
    notificationCount,
    unreadMessages,
  }
}
