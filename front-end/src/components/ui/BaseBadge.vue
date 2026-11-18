<script setup lang="ts">
import { computed } from "vue"

const props = withDefaults(defineProps<{
  tone?: "neutral" | "accent" | "success" | "warning" | "danger"
}>(), {
  tone: "neutral",
})

const toneClass = computed(() => ({
  neutral: "bg-[var(--panel-inset)] text-[var(--muted)] border-[var(--line)]",
  accent: "bg-[var(--accent-soft)] text-[var(--accent-strong)] border-transparent",
  success: "bg-[color:color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)] border-transparent",
  warning: "bg-[color:color-mix(in_srgb,var(--warning)_16%,transparent)] text-[var(--warning)] border-transparent",
  danger: "bg-[color:color-mix(in_srgb,var(--danger)_16%,transparent)] text-[var(--danger)] border-transparent",
}[props.tone]))
</script>

<template>
  <span class="text-xs font-semibold px-2.5 py-1 border rounded-full inline-flex gap-1 items-center" :class="toneClass">
    <slot />
  </span>
</template>
