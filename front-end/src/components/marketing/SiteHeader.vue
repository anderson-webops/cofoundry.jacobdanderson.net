<script setup lang="ts">
import { marketingNavigation } from "~/shared/constants/app"

const menuOpen = ref(false)
</script>

<template>
  <header class="bg-[color:color-mix(in_srgb,var(--bg)_84%,transparent)] border-b border-[var(--line)] top-0 sticky z-40 backdrop-blur-xl">
    <div class="page-shell py-4 flex items-center justify-between">
      <AppLogo />
      <nav class="text-sm text-[var(--muted)] gap-8 hidden items-center lg:flex">
        <NuxtLink v-for="item in marketingNavigation" :key="item.to" :to="item.to" class="transition hover:text-[var(--text)]">
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="gap-3 hidden items-center lg:flex">
        <ThemeToggle />
        <BaseButton variant="ghost" to="/auth/sign-in">
          Sign in
        </BaseButton>
        <BaseButton to="/auth/sign-up">
          Start free
        </BaseButton>
      </div>
      <button class="p-2 border border-[var(--line)] rounded-full lg:hidden" @click="menuOpen = !menuOpen">
        <span class="i-carbon-menu" />
      </button>
    </div>
    <div v-if="menuOpen" class="page-shell pb-4 gap-3 grid lg:hidden">
      <NuxtLink v-for="item in marketingNavigation" :key="item.to" :to="item.to" class="px-3 py-2 rounded-2xl hover:bg-[var(--accent-soft)]" @click="menuOpen = false">
        {{ item.label }}
      </NuxtLink>
      <div class="flex gap-3">
        <BaseButton variant="ghost" to="/auth/sign-in" block>
          Sign in
        </BaseButton>
        <BaseButton to="/auth/sign-up" block>
          Start free
        </BaseButton>
      </div>
    </div>
  </header>
</template>
