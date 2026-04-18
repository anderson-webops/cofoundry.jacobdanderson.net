<script setup lang="ts">
import type { ThemeSchemeId } from "~/shared/utils/theme"
import { onClickOutside, useEventListener } from "@vueuse/core"
import { isDarkThemeValue } from "~/shared/utils/theme"

withDefaults(defineProps<{
  align?: "start" | "end"
  compact?: boolean
}>(), {
  align: "end",
  compact: false,
})

const colorMode = useColorMode()
const { activeScheme, scheme, schemes } = useThemeScheme()

const open = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const isDark = computed(() => isDarkThemeValue(colorMode.value))

function toggleOpen() {
  open.value = !open.value
}

function selectScheme(nextScheme: ThemeSchemeId) {
  scheme.value = nextScheme
}

onClickOutside(panelRef, () => {
  open.value = false
}, {
  ignore: [triggerRef],
})

useEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Escape")
    open.value = false
})
</script>

<template>
  <div
    class="flex flex-col gap-3 relative z-[20]"
    :class="align === 'start' ? 'items-start' : 'items-end'"
  >
    <div
      v-if="open"
      ref="panelRef"
      class="panel p-4 shadow-[0_28px_80px_rgba(0,0,0,0.28)] bottom-[calc(100%+0.75rem)] absolute"
      :class="[
        align === 'start' ? 'left-0' : 'right-0',
        compact ? 'w-[min(28rem,calc(100vw-1rem))]' : 'w-[min(30rem,calc(100vw-1rem))]',
      ]"
    >
      <div class="flex gap-4 items-start justify-between">
        <div>
          <p class="section-kicker">
            Color scheme
          </p>
          <h2 class="text-base font-semibold mt-2">
            Choose the palette family
          </h2>
          <p class="muted text-sm leading-6 mt-2">
            The palette applies to both light and dark mode. Current mode: {{ isDark ? "Dark" : "Light" }}.
          </p>
        </div>
        <button
          type="button"
          class="rounded-full border border-[var(--line)] p-2 text-[var(--text)] transition hover:bg-[var(--accent-soft)]"
          aria-label="Close color scheme picker"
          @click="open = false"
        >
          <span class="i-carbon-close text-base" />
        </button>
      </div>

      <div class="mt-4 gap-3 grid">
        <button
          v-for="option in schemes"
          :key="option.id"
          type="button"
          class="p-4 text-left border rounded-[1.25rem] transition"
          :class="option.id === scheme
            ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_28%,transparent)]'
            : 'border-[var(--line)] bg-[var(--panel-strong)] hover:border-[var(--line-strong)]'"
          @click="selectScheme(option.id)"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap gap-2 items-center">
                <span class="font-semibold">{{ option.label }}</span>
                <BaseBadge v-if="option.isDefault" tone="neutral">
                  Default
                </BaseBadge>
                <BaseBadge v-if="option.id === scheme" tone="accent">
                  Active
                </BaseBadge>
              </div>
              <p class="muted text-sm leading-6 mt-2">
                {{ option.description }}
              </p>
            </div>

            <div class="flex self-start shrink-0 gap-2">
              <div class="p-1.5 border border-black/8 rounded-2xl bg-white/40">
                <div class="flex gap-1">
                  <span class="border border-black/8 rounded-xl h-7 w-7" :style="{ backgroundColor: option.swatches.light.surface }" />
                  <span class="rounded-full h-7 w-3" :style="{ backgroundColor: option.swatches.light.accent }" />
                  <span class="rounded-full h-7 w-3" :style="{ backgroundColor: option.swatches.light.text }" />
                </div>
              </div>
              <div class="p-1.5 border border-white/8 rounded-2xl bg-black/15">
                <div class="flex gap-1">
                  <span class="border border-white/10 rounded-xl h-7 w-7" :style="{ backgroundColor: option.swatches.dark.surface }" />
                  <span class="rounded-full h-7 w-3" :style="{ backgroundColor: option.swatches.dark.accent }" />
                  <span class="rounded-full h-7 w-3" :style="{ backgroundColor: option.swatches.dark.text }" />
                </div>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>

    <button
      ref="triggerRef"
      type="button"
      class="panel px-4 py-3 inline-flex gap-3 shadow-[0_20px_60px_rgba(0,0,0,0.16)] transition items-center hover:border-[var(--line-strong)]"
      :class="compact ? 'w-full justify-between' : ''"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggleOpen"
    >
      <span class="i-carbon-color-palette text-[var(--accent)]" />
      <span
        class="text-sm font-semibold"
        :class="compact ? 'min-w-[4.75rem] text-left' : ''"
      >{{ activeScheme.label }}</span>
      <span class="muted text-xs tracking-[0.14em] uppercase">
        {{ isDark ? "Dark" : "Light" }}
      </span>
    </button>
  </div>
</template>
