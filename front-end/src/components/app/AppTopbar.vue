<script setup lang="ts">
import { getUnreadMessages } from "~/shared/utils/workspace"

const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()

const notificationCount = computed(() => workspaceStore.data.notifications.filter(notification => notification.userId === authStore.currentUser?.id && !notification.readAt).length)
const unreadMessages = computed(() => authStore.currentUser?.id ? getUnreadMessages(workspaceStore.data, authStore.currentUser.id) : 0)
</script>

<template>
  <div class="panel px-5 py-4 flex gap-4 items-center justify-between">
    <div>
      <p class="muted text-sm">
        Product workspace
      </p>
      <p class="text-lg font-semibold">
        {{ authStore.currentUser?.name || "Member" }}
      </p>
    </div>

    <div class="flex gap-3 items-center">
      <BaseBadge tone="accent">
        {{ unreadMessages }} unread messages
      </BaseBadge>
      <BaseBadge :tone="notificationCount ? 'warning' : 'neutral'">
        {{ notificationCount }} notifications
      </BaseBadge>
      <BaseButton variant="ghost" to="/app/settings">
        <span class="i-carbon-settings-adjust" />
        Settings
      </BaseButton>
    </div>
  </div>
</template>
