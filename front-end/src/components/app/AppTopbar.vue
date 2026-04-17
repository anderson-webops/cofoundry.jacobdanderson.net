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
  <div class="panel px-5 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div class="min-w-0">
      <p class="section-kicker">
        {{ routeContext.areaLabel }}
      </p>
      <div class="mt-2 flex flex-wrap gap-2 items-center">
        <p class="text-lg font-semibold">
          {{ routeContext.title }}
        </p>
        <BaseBadge tone="neutral">
          {{ authStore.currentUser?.name || "Member" }}
        </BaseBadge>
      </div>
      <p class="muted text-sm leading-6 mt-2 max-w-2xl">
        {{ routeContext.description }}
      </p>
    </div>

    <div class="flex flex-wrap gap-2 items-center md:justify-end">
      <BaseButton variant="ghost" size="sm" to="/app/inbox">
        <span class="i-carbon-inbox" />
        Inbox
        <span class="text-xs text-[var(--muted)]">
          {{ inboxActionCount }} live
        </span>
      </BaseButton>
      <BaseBadge tone="accent">
        {{ unreadMessages }} unread messages
      </BaseBadge>
      <BaseBadge :tone="notificationCount ? 'warning' : 'neutral'">
        {{ notificationCount }} notifications
      </BaseBadge>
      <BaseButton variant="ghost" size="sm" to="/app/settings">
        <span class="i-carbon-settings-adjust" />
        Settings
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="signOut">
        <span class="i-carbon-logout" />
        Sign out
      </BaseButton>
    </div>
  </div>
</template>
