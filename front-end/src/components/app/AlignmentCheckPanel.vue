<script setup lang="ts">
import type { Profile } from "~/shared/types/domain"
import { computed } from "vue"
import BaseBadge from "~/components/ui/BaseBadge.vue"
import { buildAlignmentCheck } from "~/shared/utils/formation"

const props = defineProps<{
  currentProfile: Profile
  counterpartProfile: Profile
  title?: string
}>()

const items = computed(() => buildAlignmentCheck(props.currentProfile, props.counterpartProfile))

function tone(status: "aligned" | "review" | "missing") {
  if (status === "aligned")
    return "success"

  if (status === "review")
    return "warning"

  return "neutral"
}

function label(status: "aligned" | "review" | "missing") {
  return {
    aligned: "Aligned",
    review: "Review live",
    missing: "Needs input",
  }[status]
}
</script>

<template>
  <div class="panel p-5">
    <h2 class="text-lg font-semibold">
      {{ title || "Alignment check" }}
    </h2>
    <p class="muted text-sm leading-6 mt-2">
      CoFoundry uses this layer to pressure-test commitment, governance, scope, and IP before a proposal becomes the source of truth.
    </p>
    <div class="mt-4 gap-3 grid">
      <div
        v-for="item in items"
        :key="item.id"
        class="panel-inset p-4 flex gap-3 items-start justify-between"
      >
        <div>
          <p class="text-sm font-semibold">
            {{ item.title }}
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ item.summary }}
          </p>
        </div>
        <BaseBadge :tone="tone(item.status)">
          {{ label(item.status) }}
        </BaseBadge>
      </div>
    </div>
  </div>
</template>
