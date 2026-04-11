<script setup lang="ts">
const colorMode = useColorMode()

const isDark = computed({
  get: () => colorMode.preference === "dark",
  set: (value: boolean) => {
    colorMode.preference = value ? "dark" : "light"
  },
})
</script>

<template>
  <button
    type="button"
    class="text-sm px-3 py-2 border border-[var(--line)] rounded-full bg-[var(--panel-strong)] inline-flex gap-2 items-center"
    @click="isDark = !isDark"
  >
    <span :class="isDark ? 'i-carbon-moon' : 'i-carbon-sun'" />
    <span>{{ isDark ? "Dark" : "Light" }}</span>
  </button>
</template>
