<script setup lang="ts">
import { getUnreadMessages } from "~/shared/utils/workspace"

const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()

const notificationCount = computed(() => workspaceStore.data.notifications.filter(notification => notification.userId === authStore.currentUser?.id && !notification.readAt).length)
const unreadMessages = computed(() => authStore.currentUser?.id ? getUnreadMessages(workspaceStore.data, authStore.currentUser.id) : 0)

async function signOut() {
  await authStore.signOut()
  await navigateTo("/auth/sign-in")
}
</script>

<template>
  <div class="panel px-5 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <p class="muted text-sm">
        Product workspace
      </p>
      <p class="text-lg font-semibold">
        {{ authStore.currentUser?.name || "Member" }}
      </p>
    </div>

    <div class="flex flex-wrap gap-2 items-center md:justify-end">
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
