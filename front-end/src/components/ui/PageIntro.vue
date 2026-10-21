<script setup lang="ts">
import { computed } from "vue"

const props = withDefaults(defineProps<{
  eyebrow?: string
  title: string
  description?: string
  headingLevel?: 1 | 2
}>(), {
  headingLevel: 1,
})

const headingTag = computed(() => `h${props.headingLevel}`)
const headingClass = computed(() => props.headingLevel === 1
  ? "text-[clamp(2rem,1.5rem+2vw,3rem)] leading-[1.1]"
  : "text-2xl leading-tight md:text-3xl")
</script>

<template>
  <div class="flex flex-col gap-5 md:flex-row md:gap-8 md:items-end md:justify-between">
    <div class="max-w-[48rem]">
      <p v-if="eyebrow" class="section-kicker">
        {{ eyebrow }}
      </p>
      <component :is="headingTag" class="tracking-tight font-semibold max-w-[38rem]" :class="[headingClass, eyebrow ? 'mt-3' : '']">
        {{ title }}
      </component>
      <p v-if="description" class="muted text-[1.0625rem] leading-[1.7] mt-4 max-w-[42rem]">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap gap-3 items-center md:justify-end">
      <slot name="actions" />
    </div>
  </div>
</template>
