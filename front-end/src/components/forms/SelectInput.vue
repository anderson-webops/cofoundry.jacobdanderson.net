<script setup lang="ts">
defineProps<{
  label: string
  options: { label: string, value: string }[]
  helper?: string
  error?: string
}>()

const model = defineModel<string>({ default: "" })
</script>

<template>
  <label class="block">
    <span class="field-label">
      <span>{{ label }}</span>
    </span>
    <select v-model="model" class="field-control">
      <option disabled value="">
        Select an option
      </option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <p v-if="error" class="field-error">
      {{ error }}
    </p>
    <p v-else-if="helper" class="field-helper">
      {{ helper }}
    </p>
  </label>
</template>
