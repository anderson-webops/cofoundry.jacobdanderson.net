<script setup lang="ts">
defineProps<{
  title: string
  preview: string
  unreadCount: number
  href: string
  when: string
}>()
</script>

<template>
  <NuxtLink :to="href" class="panel p-4 block transition hover:-translate-y-0.5">
    <div class="flex gap-4 items-start justify-between">
      <div>
        <h3 class="text-sm font-semibold">
          {{ title }}
        </h3>
        <p class="muted text-sm leading-6 mt-2 line-clamp-2">
          {{ preview }}
        </p>
      </div>
      <BaseBadge :tone="unreadCount ? 'accent' : 'neutral'">
        {{ unreadCount ? `${unreadCount} new` : "Read" }}
      </BaseBadge>
    </div>
    <p class="muted text-xs mt-3">
      {{ when }}
    </p>
  </NuxtLink>
</template>
