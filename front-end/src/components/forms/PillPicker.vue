<script setup lang="ts">
defineProps<{
  label: string
  options: string[]
  helper?: string
}>()

const model = defineModel<string[]>({ default: [] })

function toggle(value: string) {
  if (model.value.includes(value))
    model.value = model.value.filter(item => item !== value)
  else
    model.value = [...model.value, value]
}
</script>

<template>
  <div class="block">
    <span class="field-label">
      <span>{{ label }}</span>
    </span>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="option in options"
        :key="option"
        type="button"
        class="pill"
        :class="model.includes(option) ? 'pill-active' : ''"
        @click="toggle(option)"
      >
        {{ option }}
      </button>
    </div>
    <p v-if="helper" class="field-helper">
      {{ helper }}
    </p>
  </div>
</template>
