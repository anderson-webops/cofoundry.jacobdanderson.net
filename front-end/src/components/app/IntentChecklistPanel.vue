<script setup lang="ts">
import type { Profile } from "~/shared/types/domain"
import { computed } from "vue"
import BaseBadge from "~/components/ui/BaseBadge.vue"
import { buildIntentChecklist } from "~/shared/utils/formation"

const props = defineProps<{
  profile: Profile
  title?: string
}>()

const checklist = computed(() => buildIntentChecklist(props.profile))
</script>

<template>
  <div class="panel p-5">
    <h2 class="text-lg font-semibold">
      {{ title || "Seriousness checklist" }}
    </h2>
    <div class="surface-row-list mt-4">
      <div
        v-for="item in checklist"
        :key="item.id"
        class="surface-row flex gap-3 items-start justify-between"
      >
        <div>
          <p class="text-sm font-semibold">
            {{ item.title }}
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ item.description }}
          </p>
        </div>
        <BaseBadge :tone="item.complete ? 'success' : 'warning'">
          {{ item.complete ? "Ready" : "Needs work" }}
        </BaseBadge>
      </div>
    </div>
  </div>
</template>
