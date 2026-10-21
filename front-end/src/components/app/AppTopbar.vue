<script setup lang="ts">
import { buildInboxSnapshot } from "~/shared/utils/inbox"
import { getUnreadMessages } from "~/shared/utils/workspace"
import { resolveWorkspaceRouteContext } from "~/shared/utils/workspace-navigation"

const authStore = useAuthStore()
const toastStore = useToastStore()
const workspaceStore = useWorkspaceStore()
const route = useRoute()

const notificationCount = computed(() => workspaceStore.data.notifications.filter(notification => notification.userId === authStore.currentUser?.id && !notification.readAt).length)
const unreadMessages = computed(() => authStore.currentUser?.id ? getUnreadMessages(workspaceStore.data, authStore.currentUser.id) : 0)
const inboxActionCount = computed(() => authStore.currentUser?.id ? buildInboxSnapshot(workspaceStore.data, authStore.currentUser.id).actions.length : 0)
const routeContext = computed(() => resolveWorkspaceRouteContext(route.path))
const syncLabel = computed(() => {
  if (workspaceStore.hydrating)
    return "Syncing"

  if (!workspaceStore.lastSyncedAt)
    return "Local"

  return `Synced ${new Date(workspaceStore.lastSyncedAt).toISOString().slice(11, 16)} UTC`
})

async function refreshWorkspace() {
  try {
    await workspaceStore.loadWorkspace(true)
  }
  catch {
    toastStore.push({
      title: "Refresh failed",
      message: "The workspace could not be refreshed. Your current view is still available.",
      tone: "warning",
    })
  }
}

async function signOut() {
  await authStore.signOut()
  await navigateTo("/auth/sign-in")
}
</script>

<template>
  <div class="pb-4 border-b border-[var(--line)] flex flex-col gap-3 md:pb-5 md:flex-row md:items-center md:justify-between">
    <div class="min-w-0">
      <p class="section-kicker hidden sm:block">
        {{ routeContext.areaLabel }}
      </p>
      <div class="flex flex-wrap gap-2 items-center sm:mt-2">
        <p class="text-base font-semibold md:text-lg">
          {{ routeContext.title }}
        </p>
        <BaseBadge class="hidden md:inline-flex" tone="neutral">
          {{ authStore.currentUser?.name || "Member" }}
        </BaseBadge>
      </div>
    </div>

    <div class="flex flex-wrap gap-2 items-center md:justify-end">
      <BaseButton variant="ghost" size="sm" to="/app/inbox">
        <span class="i-carbon-inbox" />
        <span>Inbox</span>
        <span class="text-xs text-[var(--muted)] hidden lg:inline">
          {{ inboxActionCount }} live
        </span>
      </BaseButton>
      <BaseBadge tone="accent" class="hidden sm:inline-flex">
        {{ unreadMessages }} unread
      </BaseBadge>
      <BaseBadge :tone="notificationCount ? 'warning' : 'neutral'" class="hidden sm:inline-flex">
        {{ notificationCount }} alerts
      </BaseBadge>
      <BaseButton variant="ghost" size="sm" :disabled="workspaceStore.hydrating" :aria-label="workspaceStore.hydrating ? 'Refreshing workspace' : 'Refresh workspace'" @click="refreshWorkspace">
        <span :class="workspaceStore.hydrating ? 'i-carbon-renew animate-spin' : 'i-carbon-renew'" />
        <span class="hidden lg:inline">{{ syncLabel }}</span>
      </BaseButton>
      <BaseButton variant="ghost" size="sm" to="/app/settings" aria-label="Settings">
        <span class="i-carbon-settings-adjust" />
        <span class="hidden md:inline">Settings</span>
      </BaseButton>
      <BaseButton variant="ghost" size="sm" aria-label="Sign out" @click="signOut">
        <span class="i-carbon-logout" />
        <span class="hidden md:inline">Sign out</span>
      </BaseButton>
    </div>
  </div>
</template>
