<script setup lang="ts">
import { resolveWorkspaceRouteContext } from "~/shared/utils/workspace-navigation"

const authStore = useAuthStore()
const toastStore = useToastStore()
const workspaceStore = useWorkspaceStore()
const route = useRoute()
const { inboxActionCount, notificationCount, unreadMessages } = useWorkspaceCounts()

const routeContext = computed(() => resolveWorkspaceRouteContext(route.path))
const isAdminArea = computed(() => route.path.startsWith("/admin"))
const syncLabel = computed(() => {
  if (workspaceStore.hydrating)
    return "Syncing"

  if (!workspaceStore.lastSyncedAt)
    return "Local"

  return `Synced ${new Date(workspaceStore.lastSyncedAt).toISOString().slice(11, 16)} UTC`
})
const attentionSummary = computed(() => {
  const parts = [
    unreadMessages.value ? `${unreadMessages.value} unread` : "",
    notificationCount.value ? `${notificationCount.value} ${notificationCount.value === 1 ? "alert" : "alerts"}` : "",
  ].filter(Boolean)

  return parts.join(" · ")
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
  <div class="pb-3 border-b border-[var(--line)] flex flex-wrap gap-3 items-center justify-between">
    <nav aria-label="Breadcrumb" class="text-sm min-w-0">
      <ol class="muted flex flex-wrap gap-1.5 items-center">
        <li>{{ routeContext.areaLabel }}</li>
        <li aria-hidden="true" class="i-carbon-chevron-right text-xs" />
        <li class="text-[var(--text)] font-semibold" aria-current="page">
          {{ routeContext.title }}
        </li>
      </ol>
    </nav>

    <div class="flex flex-wrap gap-1.5 items-center">
      <span v-if="attentionSummary" class="muted text-sm mr-1 hidden sm:inline">
        {{ attentionSummary }}
      </span>
      <BaseButton variant="ghost" size="sm" to="/app/inbox">
        <span class="i-carbon-task" aria-hidden="true" />
        <span>Inbox</span>
        <span v-if="inboxActionCount" class="nav-count ml-0" :aria-label="`${inboxActionCount} actions waiting`">
          {{ inboxActionCount }}
        </span>
      </BaseButton>
      <BaseButton variant="ghost" size="sm" :disabled="workspaceStore.hydrating" :aria-label="workspaceStore.hydrating ? 'Refreshing workspace' : 'Refresh workspace'" :title="syncLabel" @click="refreshWorkspace">
        <span :class="workspaceStore.hydrating ? 'i-carbon-renew animate-spin' : 'i-carbon-renew'" aria-hidden="true" />
        <span class="hidden xl:inline">{{ syncLabel }}</span>
      </BaseButton>
      <BaseButton v-if="isAdminArea" variant="ghost" size="sm" aria-label="Sign out" @click="signOut">
        <span class="i-carbon-logout" aria-hidden="true" />
        <span class="hidden md:inline">Sign out</span>
      </BaseButton>
    </div>
  </div>
</template>
