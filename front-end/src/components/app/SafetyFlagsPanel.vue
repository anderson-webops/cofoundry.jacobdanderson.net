<script setup lang="ts">
defineProps<{
  flags: string[]
  title?: string
}>()
</script>

<template>
  <div v-if="flags.length" class="panel-inset p-5">
    <div class="flex gap-3 items-center justify-between">
      <div>
        <h3 class="text-base font-semibold">
          {{ title || "Safety notice" }}
        </h3>
        <p class="muted text-sm mt-1">
          CoFoundry flags patterns that often show up in off-platform or impersonation scams.
        </p>
      </div>
      <BaseBadge tone="warning">
        Review carefully
      </BaseBadge>
    </div>

    <ul class="mt-4 gap-3 grid">
      <li v-for="flag in flags" :key="flag" class="flex gap-3 items-start">
        <span class="i-carbon-warning-filled text-[var(--warning)] mt-1" />
        <span class="muted text-sm leading-6">{{ flag }}</span>
      </li>
    </ul>
  </div>
</template>
