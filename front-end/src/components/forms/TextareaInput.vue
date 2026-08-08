<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  placeholder?: string
  helper?: string
  error?: string
  rows?: number
  disabled?: boolean
}>(), {
  disabled: false,
  placeholder: "",
  helper: "",
  error: "",
  rows: 5,
})

const model = defineModel<string>({ default: "" })
</script>

<template>
  <label class="block">
    <span class="field-label">
      <span>{{ label }}</span>
    </span>
    <textarea v-model="model" :rows="rows" :placeholder="placeholder" :disabled="disabled" class="field-control resize-y" />
    <p v-if="error" class="field-error">
      {{ error }}
    </p>
    <p v-else-if="helper" class="field-helper">
      {{ helper }}
    </p>
  </label>
</template>
