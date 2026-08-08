<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
const isOpen = defineModel<boolean>({ default: false })
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isOpen" class="p-4 bg-black/45 flex items-start inset-0 justify-center fixed z-80 overflow-y-auto sm:items-center" @keydown.esc="isOpen = false">
        <div class="panel flex flex-col max-h-[calc(100dvh-2rem)] max-w-2xl w-full overflow-hidden" role="dialog" aria-modal="true" :aria-label="title">
          <div class="p-6 flex shrink-0 gap-4 items-start justify-between">
            <div>
              <h2 class="text-xl font-semibold">
                {{ title }}
              </h2>
              <p v-if="description" class="muted text-sm mt-2">
                {{ description }}
              </p>
            </div>
            <button type="button" aria-label="Close dialog" class="text-lg p-2 rounded-full hover:bg-[var(--accent-soft)]" @click="isOpen = false">
              <span class="i-carbon-close" />
            </button>
          </div>
          <div class="hairline shrink-0" />
          <div class="p-6 overscroll-contain overflow-y-auto">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
