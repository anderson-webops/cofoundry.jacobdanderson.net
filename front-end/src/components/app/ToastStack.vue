<script setup lang="ts">
const toastStore = useToastStore()
</script>

<template>
  <div class="flex flex-col gap-3 max-w-sm w-full pointer-events-none right-4 top-4 fixed z-90">
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-for="toast in toastStore.items"
        :key="toast.id"
        class="panel pointer-events-auto overflow-hidden"
      >
        <div
          class="h-1"
          :class="{
            'bg-[var(--accent)]': toast.tone === 'info',
            'bg-[var(--success)]': toast.tone === 'success',
            'bg-[var(--warning)]': toast.tone === 'warning',
            'bg-[var(--danger)]': toast.tone === 'danger',
          }"
        />
        <div class="p-4 flex gap-3 items-start justify-between">
          <div>
            <p class="text-sm font-semibold">
              {{ toast.title }}
            </p>
            <p class="muted text-sm leading-6 mt-1">
              {{ toast.message }}
            </p>
          </div>
          <button class="p-2 rounded-full hover:bg-[var(--accent-soft)]" @click="toastStore.dismiss(toast.id)">
            <span class="i-carbon-close" />
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>
