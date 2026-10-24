<script setup lang="ts">
import type { ActivationPlan } from "~/shared/utils/activation"
import { computed } from "vue"

const props = defineProps<{
  compact?: boolean
  plan: ActivationPlan
}>()

const visibleSteps = computed(() => {
  if (!props.compact)
    return props.plan.steps

  const pending = props.plan.steps.filter(step => step.status === "current")
  return (pending.length ? pending : props.plan.steps.filter(step => step.status !== "locked")).slice(0, 2)
})
</script>

<template>
  <div class="panel p-5">
    <div class="flex gap-4 items-start justify-between">
      <div>
        <h2 class="text-lg font-semibold">
          Activation path
        </h2>
      </div>
      <BaseBadge :tone="plan.percent === 100 ? 'success' : 'accent'">
        {{ plan.percent }}%
      </BaseBadge>
    </div>

    <div class="mt-5">
      <div class="rounded-full bg-[var(--panel-inset)] h-2 overflow-hidden">
        <div class="rounded-full bg-[var(--accent)] h-full transition-all duration-300" :style="{ width: `${plan.percent}%` }" />
      </div>
      <p class="muted text-sm leading-6 mt-3">
        {{ plan.completedCount }} of {{ plan.totalCount }} activation gates clear.
      </p>
    </div>

    <div class="surface-row-list mt-5">
      <div
        v-for="step in visibleSteps"
        :key="step.id"
        class="surface-row flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <p class="text-sm font-semibold flex flex-wrap gap-2 items-center">
            {{ step.title }}
            <BaseBadge :tone="step.badgeTone">
              {{ step.badgeLabel }}
            </BaseBadge>
          </p>
          <p v-if="step.missingItems.length" class="muted text-xs leading-5 mt-2">
            Missing: {{ step.missingItems.join(", ") }}
          </p>
        </div>
        <BaseButton v-if="step.status !== 'locked'" :variant="step.status === 'current' ? 'secondary' : 'ghost'" size="sm" :to="step.href" class="shrink-0 self-start">
          {{ step.ctaLabel }}
        </BaseButton>
      </div>
    </div>

    <div v-if="compact" class="mt-5">
      <BaseButton variant="secondary" to="/app/activation">
        Open activation plan
      </BaseButton>
    </div>
  </div>
</template>
