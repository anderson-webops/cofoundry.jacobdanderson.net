<script setup lang="ts">
import { buildInboxSnapshot } from "~/shared/utils/inbox"
import { getUnreadMessages } from "~/shared/utils/workspace"
import { resolveWorkspaceRouteContext } from "~/shared/utils/workspace-navigation"

const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()
const route = useRoute()

const notificationCount = computed(() => workspaceStore.data.notifications.filter(notification => notification.userId === authStore.currentUser?.id && !notification.readAt).length)
const unreadMessages = computed(() => authStore.currentUser?.id ? getUnreadMessages(workspaceStore.data, authStore.currentUser.id) : 0)
const inboxActionCount = computed(() => authStore.currentUser?.id ? buildInboxSnapshot(workspaceStore.data, authStore.currentUser.id).actions.length : 0)
const routeContext = computed(() => resolveWorkspaceRouteContext(route.path))

async function signOut() {
  await authStore.signOut()
  await navigateTo("/auth/sign-in")
}
</script>

<template>
  <div class="panel px-4 py-3 flex flex-col gap-3 md:px-5 md:py-4 md:flex-row md:items-center md:justify-between">
    <div class="min-w-0">
      <p class="section-kicker">
        {{ routeContext.areaLabel }}
      </p>
      <div class="mt-2 flex flex-wrap gap-2 items-center">
        <p class="text-base font-semibold md:text-lg">
          {{ routeContext.title }}
        </p>
        <BaseBadge class="hidden sm:inline-flex" tone="neutral">
          {{ authStore.currentUser?.name || "Member" }}
        </BaseBadge>
      </div>
      <p class="muted text-sm leading-6 mt-2 max-w-2xl hidden sm:block">
        {{ routeContext.description }}
      </p>
    </div>

    <div class="gap-2 grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center md:justify-end">
      <BaseButton variant="ghost" size="sm" to="/app/inbox" class="justify-start sm:justify-center">
        <span class="i-carbon-inbox" />
        <span>Inbox</span>
        <span class="text-xs text-[var(--muted)] hidden sm:inline">
          {{ inboxActionCount }} live
        </span>
      </BaseButton>
      <BaseBadge tone="accent" class="min-h-9 justify-center sm:min-h-0">
        {{ unreadMessages }} unread
      </BaseBadge>
      <BaseBadge :tone="notificationCount ? 'warning' : 'neutral'" class="min-h-9 justify-center sm:min-h-0">
        {{ notificationCount }} alerts
      </BaseBadge>
      <BaseButton variant="ghost" size="sm" to="/app/settings" aria-label="Settings">
        <span class="i-carbon-settings-adjust" />
        <span class="hidden sm:inline">Settings</span>
      </BaseButton>
      <BaseButton variant="ghost" size="sm" aria-label="Sign out" @click="signOut">
        <span class="i-carbon-logout" />
        <span class="hidden sm:inline">Sign out</span>
      </BaseButton>
    </div>
  </div>
</template>
