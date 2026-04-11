<script setup lang="ts">
import { getThemeTogglePreference, isDarkThemeValue } from "~/shared/utils/theme"

const colorMode = useColorMode()

const isDark = computed(() => isDarkThemeValue(colorMode.value))

function toggleTheme() {
  colorMode.preference = getThemeTogglePreference(colorMode.value)
}
</script>

<template>
  <button
    type="button"
    :aria-pressed="isDark"
    class="text-sm px-3 py-2 border border-[var(--line)] rounded-full bg-[var(--panel-strong)] inline-flex gap-2 items-center"
    @click="toggleTheme"
  >
    <span :class="isDark ? 'i-carbon-moon' : 'i-carbon-sun'" />
    <span>{{ isDark ? "Dark" : "Light" }}</span>
  </button>
</template>
