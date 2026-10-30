<script setup lang="ts">
const mobileNavOpen = ref(false)
const authStore = useAuthStore()

const navigation = [
  { icon: "i-carbon-list-checked", label: "Review queue", to: "/investment-review" },
]

useHead({
  meta: [
    { name: "robots", content: "noindex, nofollow" }
  ],
})

async function signOut() {
  await authStore.signOut()
  await navigateTo("/auth/sign-in")
}
</script>

<template>
  <div class="py-4 min-h-screen lg:py-5">
    <div class="workspace-shell gap-5 grid min-h-[calc(100vh-2rem)] lg:grid-cols-[256px_minmax(0,1fr)] lg:min-h-[calc(100vh-2.5rem)]">
      <aside class="panel p-4 flex-col h-full hidden lg:flex">
        <div class="mb-6 flex items-center justify-between">
          <AppLogo />
          <ThemeToggle />
        </div>
        <p class="section-kicker px-3">
          Investment review
        </p>
        <nav class="mt-3 gap-1 grid">
          <NuxtLink
            v-for="item in navigation"
            :key="item.to"
            :to="item.to"
            class="text-sm text-[var(--muted)] font-medium px-3 py-2.5 rounded-2xl flex gap-3 transition items-center hover:text-[var(--text)] hover:bg-[var(--accent-soft)]"
            active-class="bg-[var(--accent-soft)] text-[var(--text)]"
          >
            <span :class="item.icon" />
            <span>{{ item.label }}</span>
          </NuxtLink>
          <NuxtLink
            v-if="authStore.currentUser?.role === 'admin'"
            to="/admin"
            class="text-sm text-[var(--muted)] font-medium px-3 py-2.5 rounded-2xl flex gap-3 transition items-center hover:text-[var(--text)] hover:bg-[var(--accent-soft)]"
          >
            <span class="i-carbon-dashboard" />
            <span>Platform admin</span>
          </NuxtLink>
        </nav>
        <div class="mt-auto gap-3 grid">
          <ThemeSchemePicker align="start" compact />
          <BaseButton variant="ghost" block @click="signOut">
            <span class="i-carbon-logout" />
            Sign out
          </BaseButton>
        </div>
      </aside>

      <div class="gap-5 grid content-start">
        <header class="pb-4 border-b border-[var(--line)] flex gap-3 items-center justify-between md:pb-5">
          <div class="flex gap-3 items-center">
            <div class="lg:hidden">
              <AppLogo />
            </div>
            <div>
              <p class="section-kicker hidden lg:block">
                Separate review workspace
              </p>
              <p class="text-base font-semibold lg:mt-2">
                {{ authStore.currentUser?.name || 'Reviewer' }}
              </p>
            </div>
          </div>
          <div class="flex gap-2 items-center">
            <ThemeToggle />
            <button class="p-2 border border-[var(--line)] rounded-full inline-flex items-center justify-center lg:hidden" aria-label="Toggle review navigation" @click="mobileNavOpen = !mobileNavOpen">
              <span :class="mobileNavOpen ? 'i-carbon-close' : 'i-carbon-menu'" />
            </button>
          </div>
        </header>

        <aside v-if="mobileNavOpen" class="panel p-4 lg:hidden">
          <nav class="gap-1 grid">
            <NuxtLink
              v-for="item in navigation"
              :key="item.to"
              :to="item.to"
              class="text-sm text-[var(--muted)] font-medium px-3 py-2.5 rounded-2xl flex gap-3 items-center"
              @click="mobileNavOpen = false"
            >
              <span :class="item.icon" />
              <span>{{ item.label }}</span>
            </NuxtLink>
            <BaseButton v-if="authStore.currentUser?.role === 'admin'" variant="ghost" block to="/admin">
              <span class="i-carbon-dashboard" />
              Platform admin
            </BaseButton>
            <BaseButton variant="ghost" block @click="signOut">
              <span class="i-carbon-logout" />
              Sign out
            </BaseButton>
          </nav>
        </aside>

        <main class="gap-6 grid">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>
