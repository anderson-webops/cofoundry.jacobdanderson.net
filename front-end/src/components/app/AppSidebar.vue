<script setup lang="ts">
import { appNavigation, appNavigationGroups } from "~/shared/constants/app"

const authStore = useAuthStore()
const route = useRoute()
const investmentEnabled = useFeatureFlag("featureInvestmentModule")
const { inboxActionCount, unreadMessages } = useWorkspaceCounts()

const navigationGroups = computed(() => appNavigationGroups.map(group => ({
  ...group,
  items: [
    ...appNavigation.filter(item => item.group === group.id),
    ...(group.id === "formalize" && investmentEnabled.value
      ? [{ label: "Fundraising", to: "/app/investment", icon: "i-carbon-currency", group: group.id }]
      : []),
  ],
})))

const counts = computed<Record<string, number>>(() => ({
  "/app/inbox": inboxActionCount.value,
  "/app/messages": unreadMessages.value,
}))

function isActive(to: string) {
  if (to === "/app")
    return route.path === "/app" || route.path === "/app/"

  return route.path === to || route.path.startsWith(`${to}/`)
}

async function signOut() {
  await authStore.signOut()
  await navigateTo("/auth/sign-in")
}
</script>

<template>
  <aside class="panel p-3 flex flex-col h-full">
    <div class="mb-4 px-1 flex items-center justify-between">
      <AppLogo />
      <ThemeToggle />
    </div>

    <nav aria-label="Workspace" class="pr-1 flex-1 gap-5 grid content-start overflow-y-auto">
      <div v-for="group in navigationGroups" :key="group.id" class="gap-1 grid">
        <p class="nav-group-label mb-1">
          {{ group.label }}
        </p>
        <NuxtLink
          v-for="item in group.items"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="isActive(item.to) ? 'nav-link-active' : ''"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <span :class="item.icon" class="text-lg shrink-0" aria-hidden="true" />
          <span>{{ item.label }}</span>
          <span v-if="counts[item.to]" class="nav-count" :aria-label="`${counts[item.to]} pending`">
            {{ counts[item.to] }}
          </span>
        </NuxtLink>
      </div>
    </nav>

    <div class="mt-4 pt-4 border-t border-[var(--line)] gap-3 grid">
      <ThemeSchemePicker align="start" compact />
      <div class="px-1 flex gap-3 items-center justify-between">
        <div class="min-w-0">
          <p class="text-sm font-semibold truncate">
            {{ authStore.currentUser?.name || "Member" }}
          </p>
          <p class="muted text-xs truncate">
            {{ authStore.currentUser?.email }}
          </p>
        </div>
        <BaseButton variant="ghost" size="sm" aria-label="Sign out" @click="signOut">
          <span class="i-carbon-logout" aria-hidden="true" />
        </BaseButton>
      </div>
    </div>
  </aside>
</template>
