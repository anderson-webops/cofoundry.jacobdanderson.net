<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  options: { label: string, value: string }[]
  helper?: string
  error?: string
  disabled?: boolean
}>(), {
  disabled: false,
})

const model = defineModel<string>({ default: "" })
</script>

<template>
  <label class="block">
    <span class="field-label">
      <span>{{ label }}</span>
    </span>
    <select v-model="model" class="field-control" :disabled="disabled">
      <option v-if="!props.options.some(option => option.value === '')" disabled value="">
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
