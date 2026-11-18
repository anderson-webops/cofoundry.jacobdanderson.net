<script setup lang="ts">
import type { ActivationPlan } from "~/shared/utils/activation"
import BaseBadge from "~/components/ui/BaseBadge.vue"
import BaseButton from "~/components/ui/BaseButton.vue"

defineProps<{
  compact?: boolean
  plan: ActivationPlan
}>()
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
        v-for="step in compact ? plan.steps.filter(item => item.status !== 'locked').slice(0, 2) : plan.steps"
        :key="step.id"
        class="surface-row flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
      >
        <div>
          <p class="text-sm font-semibold">
            {{ step.title }}
          </p>
          <p v-if="step.missingItems.length" class="muted text-xs leading-5 mt-2">
            Missing: {{ step.missingItems.join(", ") }}
          </p>
        </div>
        <div class="flex gap-2 items-center md:flex-col md:items-end">
          <BaseBadge :tone="step.badgeTone">
            {{ step.badgeLabel }}
          </BaseBadge>
          <BaseButton v-if="step.status !== 'locked'" variant="ghost" size="sm" :to="step.href">
            {{ step.ctaLabel }}
          </BaseButton>
        </div>
      </div>
    </div>

    <div v-if="compact" class="mt-5">
      <BaseButton variant="secondary" to="/app/activation">
        Open activation plan
      </BaseButton>
    </div>
  </div>
</template>
