<script setup lang="ts">
defineProps<{
  facts: { label: string, value: string }[]
}>()
</script>

<template>
  <dl class="text-sm gap-x-4 gap-y-3 grid grid-cols-2">
    <div v-for="fact in facts" :key="fact.label" class="min-w-0">
      <dt class="muted text-xs font-medium">
        {{ fact.label }}
      </dt>
      <dd class="font-medium m-0 mt-0.5 line-clamp-2">
        {{ fact.value }}
      </dd>
    </div>
  </dl>
</template>
