<script setup lang="ts">
import type { Profile } from "~/shared/types/domain"
import { buildProfileReadiness } from "~/shared/utils/formation"

const props = withDefaults(defineProps<{
  profile: Profile
  title?: string
  description?: string
}>(), {
  title: "Trust-critical completion",
  description: "These are the signals CoFoundry uses to decide whether a profile feels real, credible, and worth replying to.",
})

const readiness = computed(() => buildProfileReadiness(props.profile))
</script>

<template>
  <div class="panel-inset p-5 gap-4 grid">
    <div class="flex flex-wrap gap-3 items-start justify-between">
      <div>
        <h2 class="text-lg font-semibold">
          {{ title }}
        </h2>
        <p class="muted text-sm leading-6 mt-2">
          {{ description }}
        </p>
      </div>
      <BaseBadge :tone="readiness.trustReady ? 'success' : 'accent'">
        {{ readiness.trustPercent }}% complete
      </BaseBadge>
    </div>

    <div class="gap-3 grid">
      <div
        v-for="item in readiness.trustChecklist"
        :key="item.id"
        class="p-4 border border-[var(--line)] rounded-[1.25rem] bg-[var(--panel)]"
      >
        <div class="flex gap-3 items-center justify-between">
          <p class="text-sm font-semibold">
            {{ item.title }}
          </p>
          <BaseBadge :tone="item.complete ? 'success' : 'warning'">
            {{ item.complete ? "Ready" : "Missing" }}
          </BaseBadge>
        </div>
        <p class="muted text-sm leading-6 mt-2">
          {{ item.description }}
        </p>
      </div>
    </div>
  </div>
</template>
