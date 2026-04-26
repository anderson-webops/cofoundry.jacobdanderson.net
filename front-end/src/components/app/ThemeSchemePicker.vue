<script setup lang="ts">
import type { ThemeSchemeId } from "~/shared/utils/theme"
import { onClickOutside, useEventListener } from "@vueuse/core"
import { isDarkThemeValue } from "~/shared/utils/theme"

const props = withDefaults(defineProps<{
  align?: "start" | "end"
  panelAlign?: "start" | "end"
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
const panelStyle = ref<Record<string, string>>({})
const isDark = computed(() => isDarkThemeValue(colorMode.value))
const panelAlignment = computed(() => props.panelAlign ?? props.align)

function toggleOpen() {
  open.value = !open.value
}

function updatePanelPosition() {
  if (!open.value || !panelRef.value || !triggerRef.value)
    return

  const viewportMargin = 12
  const triggerRect = triggerRef.value.getBoundingClientRect()
  const panelRect = panelRef.value.getBoundingClientRect()
  const preferredLeft = panelAlignment.value === "start"
    ? triggerRect.left
    : triggerRect.right - panelRect.width
  const maxLeft = Math.max(viewportMargin, window.innerWidth - panelRect.width - viewportMargin)
  const left = Math.min(Math.max(preferredLeft, viewportMargin), maxLeft)

  panelStyle.value = {
    transform: `translateX(${Math.round(left - triggerRect.left)}px)`,
  }
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

useEventListener("resize", updatePanelPosition)

watch(open, async (nextOpen) => {
  if (!nextOpen) {
    panelStyle.value = {}
    return
  }

  await nextTick()
  updatePanelPosition()
})

watch(panelAlignment, async () => {
  if (!open.value)
    return

  await nextTick()
  updatePanelPosition()
})
</script>

<template>
  <div
    class="flex flex-col gap-3 relative z-[20]"
    :class="props.align === 'start' ? 'items-start' : 'items-end'"
  >
    <div
      v-if="open"
      ref="panelRef"
      class="panel p-4 shadow-[0_28px_80px_rgba(0,0,0,0.28)] bottom-[calc(100%+0.75rem)] left-0 absolute"
      :class="[
        props.compact ? 'w-[min(28rem,calc(100vw-1.5rem))]' : 'w-[min(30rem,calc(100vw-1.5rem))]',
      ]"
      :style="panelStyle"
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
          class="text-[var(--text)] border border-[var(--line)] rounded-full inline-flex shrink-0 h-9 w-9 transition items-center justify-center hover:bg-[var(--accent-soft)]"
          aria-label="Close color scheme picker"
          @click="open = false"
        >
          <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
          </svg>
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

            <div class="flex shrink-0 gap-2 self-start">
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
      :class="props.compact ? 'w-full justify-between' : ''"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggleOpen"
    >
      <span class="i-carbon-color-palette text-[var(--accent)]" />
      <span
        class="text-sm font-semibold"
        :class="props.compact ? 'min-w-[4.75rem] text-left' : ''"
      >{{ activeScheme.label }}</span>
      <span class="muted text-xs tracking-[0.14em] uppercase">
        {{ isDark ? "Dark" : "Light" }}
      </span>
    </button>
  </div>
</template>
