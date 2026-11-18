<script setup lang="ts">
import type { Profile } from "~/shared/types/domain"
import { computed } from "vue"
import BaseBadge from "~/components/ui/BaseBadge.vue"
import { buildProfileReadiness } from "~/shared/utils/formation"

const props = withDefaults(defineProps<{
  profile: Profile
  title?: string
  description?: string
}>(), {
  title: "Proof and verification",
  description: "These are the signals other members use to decide whether a profile feels real and worth replying to.",
})

const readiness = computed(() => buildProfileReadiness(props.profile))
</script>

<template>
  <div class="panel p-5 gap-4 grid">
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

    <div class="surface-row-list">
      <div
        v-for="item in readiness.trustChecklist"
        :key="item.id"
        class="surface-row"
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
