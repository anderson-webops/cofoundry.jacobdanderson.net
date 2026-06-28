<script setup lang="ts">
import { getThemeTogglePreference, isDarkThemeValue } from "~/shared/utils/theme"

const colorMode = useColorMode()

const isDark = computed(() => isDarkThemeValue(colorMode.value))
const mounted = ref(false)
const displayedIsDark = computed(() => mounted.value ? isDark.value : false)

onMounted(() => {
  mounted.value = true
})

function toggleTheme() {
  colorMode.preference = getThemeTogglePreference(colorMode.value)
}
</script>

<template>
  <button
    type="button"
    :aria-pressed="displayedIsDark"
    class="text-sm px-3 py-2 border border-[var(--line)] rounded-full bg-[var(--panel-strong)] inline-flex gap-2 min-h-11 items-center"
    @click="toggleTheme"
  >
    <span :class="displayedIsDark ? 'i-carbon-moon' : 'i-carbon-sun'" />
    <span>{{ displayedIsDark ? "Dark" : "Light" }}</span>
  </button>
</template>
