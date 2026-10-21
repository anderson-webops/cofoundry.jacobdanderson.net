<script setup lang="ts">
import { appNavigation } from "~/shared/constants/app"

const investmentEnabled = useFeatureFlag("featureInvestmentModule")
</script>

<template>
  <aside class="panel p-4 flex flex-col h-full">
    <div class="mb-6 flex items-center justify-between">
      <AppLogo />
      <ThemeToggle />
    </div>

    <nav class="gap-1 grid">
      <NuxtLink
        v-for="item in appNavigation"
        :key="item.to"
        :to="item.to"
        class="text-sm text-[var(--muted)] font-medium px-3 py-2.5 rounded-2xl flex gap-3 transition items-center hover:text-[var(--text)] hover:bg-[var(--accent-soft)]"
        active-class="bg-[var(--accent-soft)] text-[var(--text)]"
      >
        <span :class="item.icon" />
        <span>{{ item.label }}</span>
      </NuxtLink>

      <NuxtLink
        v-if="investmentEnabled"
        to="/app/investment"
        class="text-sm text-[var(--muted)] font-medium px-3 py-2.5 rounded-2xl flex gap-3 transition items-center hover:text-[var(--text)] hover:bg-[var(--accent-soft)]"
        active-class="bg-[var(--accent-soft)] text-[var(--text)]"
      >
        <span class="i-carbon-currency" />
        <span>Fundraising</span>
      </NuxtLink>
    </nav>

    <div class="mt-auto gap-3 grid">
      <ThemeSchemePicker align="start" compact />
    </div>
  </aside>
</template>
