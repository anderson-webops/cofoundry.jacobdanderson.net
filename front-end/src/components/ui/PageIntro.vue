<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-4 md:flex-row md:gap-6 md:items-end md:justify-between">
    <div class="max-w-[46rem]">
      <p v-if="eyebrow" class="section-kicker">
        {{ eyebrow }}
      </p>
      <h1 class="text-3xl tracking-tight font-semibold mt-2 max-w-[36rem] md:text-4xl">
        {{ title }}
      </h1>
      <p v-if="description" class="muted text-[0.98rem] leading-7 mt-4 max-w-[42rem]">
        {{ description }}
      </p>
    </div>
    <div class="flex flex-wrap gap-3 items-center md:justify-end">
      <slot name="actions" />
    </div>
  </div>
</template>
