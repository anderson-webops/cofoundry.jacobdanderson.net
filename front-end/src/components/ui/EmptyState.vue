<script setup lang="ts">
defineProps<{
  title: string
  description: string
  icon?: string
  plain?: boolean
}>()
</script>

<template>
  <div :class="plain ? 'surface-row flex flex-col gap-4 items-start' : 'panel-inset p-6 flex flex-col gap-4 items-start'">
    <div v-if="icon" class="text-xl text-[var(--accent)] p-3 rounded-2xl bg-[var(--accent-soft)]">
      <span :class="icon" />
    </div>
    <div>
      <h3 class="text-lg font-semibold">
        {{ title }}
      </h3>
      <p class="muted text-sm leading-6 mt-2 max-w-xl">
        {{ description }}
      </p>
    </div>
    <div class="flex flex-wrap gap-3">
      <slot />
    </div>
  </div>
</template>
