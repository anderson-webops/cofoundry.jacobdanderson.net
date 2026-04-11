<script setup lang="ts">
import type { StartupOpportunity } from "~/shared/types/domain"
import { formatCommitment, formatCompensation, formatRemotePreference, formatStage } from "~/shared/utils/format"

defineProps<{
  opportunity: StartupOpportunity
}>()
</script>

<template>
  <article class="panel p-5 flex flex-col gap-5 h-full">
    <div class="flex gap-4 items-start justify-between">
      <div>
        <h3 class="text-lg font-semibold">
          {{ opportunity.startupName }}
        </h3>
        <p class="muted text-sm mt-1">
          {{ opportunity.oneLinePitch }}
        </p>
      </div>
      <BaseBadge tone="accent">
        {{ formatStage(opportunity.stage) }}
      </BaseBadge>
    </div>

    <div class="flex flex-wrap gap-2">
      <BaseBadge tone="neutral">
        {{ formatRemotePreference(opportunity.remotePreference) }}
      </BaseBadge>
      <BaseBadge tone="neutral">
        {{ formatCommitment(opportunity.expectedCommitment) }}
      </BaseBadge>
      <BaseBadge tone="neutral">
        {{ formatCompensation(opportunity.compensationStructure) }}
      </BaseBadge>
    </div>

    <p class="muted text-sm leading-6">
      {{ opportunity.problem }}
    </p>

    <div class="flex flex-wrap gap-2">
      <span v-for="role in opportunity.rolesNeeded" :key="role" class="pill">
        {{ role }}
      </span>
    </div>

    <div class="muted text-sm gap-2 grid">
      <div>Traction: {{ opportunity.traction }}</div>
      <div>Equity range: {{ opportunity.equityRange }}</div>
    </div>

    <div class="mt-auto flex flex-wrap gap-3">
      <slot />
    </div>
  </article>
</template>
