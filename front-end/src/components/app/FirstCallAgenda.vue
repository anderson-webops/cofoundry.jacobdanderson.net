<script setup lang="ts">
import type { Profile } from "~/shared/types/domain"
import { formatStartTimeline } from "~/shared/utils/format"
import { firstCallAgenda } from "~/shared/utils/formation"

defineProps<{
  profile?: Profile | null
}>()
</script>

<template>
  <div class="panel-inset p-5">
    <div class="flex gap-3 items-center justify-between">
      <div>
        <h3 class="text-base font-semibold">
          Guided first call
        </h3>
      </div>
    </div>

    <div v-if="profile" class="muted text-sm leading-6 mt-4 p-4 rounded-[1rem] bg-[var(--panel-strong)]">
      Start by grounding the conversation in {{ formatStartTimeline(profile.intent.startTimeline) }}, {{ profile.intent.companyPreferences.slice(0, 2).join(" and ") }}, and the non-negotiables they already declared.
    </div>

    <ul class="mt-4 gap-3 grid">
      <li v-for="item in firstCallAgenda" :key="item.title" class="flex gap-3 items-start">
        <span class="i-carbon-checkmark-outline text-[var(--accent)] mt-1" />
        <div>
          <p class="text-sm font-semibold">
            {{ item.title }}
          </p>
          <p class="muted text-sm leading-6 mt-1">
            {{ item.body }}
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>
