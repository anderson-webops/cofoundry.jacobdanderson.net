<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { NuxtLink } from "#components"
import ThemeToggle from "~/components/app/ThemeToggle.vue"
import AppLogo from "~/components/marketing/AppLogo.vue"
import BaseButton from "~/components/ui/BaseButton.vue"
import { useProductAccess } from "~/composables/useProductAccess"
import { marketingNavigation } from "~/shared/constants/app"

const menuOpen = ref(false)
const headerVisible = ref(true)
const { getPrimaryAccessCta, getSecondaryAccessCta } = useProductAccess()
const primaryAccessCta = computed(() => getPrimaryAccessCta("site-header"))
const secondaryAccessCta = computed(() => getSecondaryAccessCta("site-header"))

let lastScrollY = 0

function handleScroll() {
  if (!import.meta.client)
    return

  const currentScrollY = window.scrollY

  if (menuOpen.value) {
    headerVisible.value = true
    lastScrollY = currentScrollY
    return
  }

  if (currentScrollY <= 24) {
    headerVisible.value = true
    lastScrollY = currentScrollY
    return
  }

  if (Math.abs(currentScrollY - lastScrollY) < 8)
    return

  headerVisible.value = currentScrollY < lastScrollY
  lastScrollY = currentScrollY
}

watch(menuOpen, (isOpen) => {
  if (!isOpen)
    return

  headerVisible.value = true
})

onMounted(() => {
  lastScrollY = window.scrollY
  window.addEventListener("scroll", handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener("scroll", handleScroll)
})
</script>

<template>
  <header
    class="will-change-transform border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--bg)_84%,transparent)] transition-transform duration-250 ease-out top-0 sticky z-40 backdrop-blur-xl"
    :class="headerVisible ? 'translate-y-0' : '-translate-y-full'"
  >
    <div class="page-shell py-4 flex items-center justify-between">
      <AppLogo />
      <nav class="text-sm text-[var(--muted)] gap-8 hidden items-center lg:flex">
        <NuxtLink v-for="item in marketingNavigation" :key="item.to" :to="item.to" class="inline-flex min-h-11 min-w-11 transition items-center justify-center hover:text-[var(--text)]">
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="gap-3 hidden items-center lg:flex">
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
    <div v-if="menuOpen" id="marketing-mobile-navigation" class="page-shell pb-4 gap-3 grid lg:hidden">
      <NuxtLink v-for="item in marketingNavigation" :key="item.to" :to="item.to" class="px-3 py-2 rounded-2xl inline-flex min-h-11 items-center hover:bg-[var(--accent-soft)]" @click="menuOpen = false">
        {{ item.label }}
      </NuxtLink>
      <div class="px-3">
        <ThemeToggle />
      </div>
      <div class="flex gap-3">
        <BaseButton variant="ghost" :to="secondaryAccessCta.to" block>
          {{ secondaryAccessCta.label }}
        </BaseButton>
        <BaseButton :to="primaryAccessCta.to" block>
          {{ primaryAccessCta.label }}
        </BaseButton>
      </div>
    </div>
  </header>
</template>
