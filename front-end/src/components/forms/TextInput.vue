<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  placeholder?: string
  type?: string
  helper?: string
  error?: string
  required?: boolean
}>(), {
  placeholder: "",
  type: "text",
  helper: "",
  error: "",
  required: false,
})

const model = defineModel<string>({ default: "" })
</script>

<template>
  <label class="block">
    <span class="field-label">
      <span>{{ label }}</span>
      <span v-if="required" class="muted text-xs">Required</span>
    </span>
    <input v-model="model" :type="type" :placeholder="placeholder" class="field-control">
    <p v-if="error" class="field-error">
      {{ error }}
    </p>
    <p v-else-if="helper" class="field-helper">
      {{ helper }}
    </p>
  </label>
</template>
