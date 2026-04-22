<script setup lang="ts">
const props = withDefaults(defineProps<{
  displayName: string
  photoUrl?: string
  size?: "sm" | "md" | "lg"
}>(), {
  photoUrl: "",
  size: "md",
})

const imageFailed = ref(false)

watch(() => props.photoUrl, () => {
  imageFailed.value = false
})

const sizeClass = computed(() => {
  return {
    sm: "h-12 w-12 text-sm",
    md: "h-16 w-16 text-lg",
    lg: "h-24 w-24 text-2xl",
  }[props.size]
})

const initials = computed(() => props.displayName
  .split(" ")
  .map(part => part.trim()[0] || "")
  .filter(Boolean)
  .slice(0, 2)
  .join("")
  .toUpperCase())
</script>

<template>
  <div
    class="text-[var(--text)] font-semibold border border-[var(--line)] rounded-[1.5rem] bg-[var(--panel-inset)] flex shrink-0 items-center justify-center overflow-hidden"
    :class="sizeClass"
  >
    <img
      v-if="photoUrl && !imageFailed"
      :src="photoUrl"
      :alt="`${displayName} profile photo`"
      class="h-full w-full object-cover"
      @error="imageFailed = true"
    >
    <span v-else>{{ initials }}</span>
  </div>
</template>
