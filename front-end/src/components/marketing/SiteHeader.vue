<script setup lang="ts">
import { marketingNavigation } from "~/shared/constants/app"

const menuOpen = ref(false)
const scrolled = ref(false)
const route = useRoute()
const { getPrimaryAccessCta, getSecondaryAccessCta } = useProductAccess()
const primaryAccessCta = computed(() => getPrimaryAccessCta("site-header"))
const secondaryAccessCta = computed(() => getSecondaryAccessCta("site-header"))

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

function handleScroll() {
  scrolled.value = window.scrollY > 8
}

watch(() => route.path, () => {
  menuOpen.value = false
})

onMounted(() => {
  handleScroll()
  window.addEventListener("scroll", handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener("scroll", handleScroll)
})
</script>

<template>
  <a href="#main-content" class="skip-link">Skip to content</a>
  <header
    class="border-b bg-[color:color-mix(in_srgb,var(--bg)_88%,transparent)] transition-colors duration-200 top-0 sticky z-40 backdrop-blur-xl"
    :class="scrolled || menuOpen ? 'border-[var(--line)]' : 'border-transparent'"
  >
    <div class="page-shell flex gap-6 h-[var(--header-height)] items-center justify-between">
      <AppLogo />
      <nav aria-label="Primary" class="text-[0.9375rem] text-[var(--muted)] gap-1 hidden items-center lg:flex">
        <NuxtLink
          v-for="item in marketingNavigation"
          :key="item.to"
          :to="item.to"
          class="px-3 rounded-[var(--radius-md)] inline-flex min-h-11 min-w-11 transition items-center justify-center hover:text-[var(--text)]"
          :class="isActive(item.to) ? 'text-[var(--text)] font-semibold bg-[var(--accent-soft)]' : ''"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="gap-2 hidden items-center lg:flex">
        <ThemeToggle />
        <BaseButton variant="ghost" :to="secondaryAccessCta.to">
          {{ secondaryAccessCta.label }}
        </BaseButton>
        <BaseButton :to="primaryAccessCta.to">
          {{ primaryAccessCta.label }}
        </BaseButton>
      </div>
      <button
        type="button"
        class="text-[var(--text)] border border-[var(--line)] rounded-full bg-[var(--panel-strong)] inline-flex h-11 w-11 items-center justify-center lg:hidden"
        aria-controls="marketing-mobile-navigation"
        :aria-expanded="menuOpen"
        aria-label="Toggle site navigation"
        @click="menuOpen = !menuOpen"
      >
        <span class="text-lg" :class="menuOpen ? 'i-carbon-close' : 'i-carbon-menu'" aria-hidden="true" />
      </button>
    </div>
    <nav v-if="menuOpen" id="marketing-mobile-navigation" aria-label="Primary" class="page-shell pb-5 gap-1 grid lg:hidden">
      <NuxtLink
        v-for="item in marketingNavigation"
        :key="item.to"
        :to="item.to"
        class="text-base px-3 py-2 rounded-[var(--radius-md)] inline-flex min-h-11 items-center hover:bg-[var(--accent-soft)]"
        :class="isActive(item.to) ? 'font-semibold bg-[var(--accent-soft)]' : ''"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        {{ item.label }}
      </NuxtLink>
      <div class="mt-3 pt-4 border-t border-[var(--line)] gap-3 grid">
        <div class="flex gap-3">
          <BaseButton variant="secondary" :to="secondaryAccessCta.to" block>
            {{ secondaryAccessCta.label }}
          </BaseButton>
          <BaseButton :to="primaryAccessCta.to" block>
            {{ primaryAccessCta.label }}
          </BaseButton>
        </div>
        <div>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  </header>
</template>
