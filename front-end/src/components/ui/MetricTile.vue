<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  context?: string
}>()
</script>

<template>
  <div class="panel-inset p-5">
    <div class="muted text-sm font-medium">
      {{ label }}
    </div>
    <div class="text-2xl font-semibold mt-3">
      {{ value }}
    </div>
    <p v-if="context" class="muted text-sm leading-6 mt-2">
      {{ context }}
    </p>
  </div>
</template>
