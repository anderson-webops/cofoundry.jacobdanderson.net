<script setup lang="ts">
import type { TrialCollaboration } from "~/shared/types/domain"
import { formatTrialStatus } from "~/shared/utils/format"
import { buildTrialStatusCopy } from "~/shared/utils/formation"

defineProps<{
  trial: TrialCollaboration
  acknowledged: boolean
}>()
</script>

<template>
  <article class="panel p-5 gap-4 grid">
    <div class="flex gap-3 items-start justify-between">
      <div>
        <h3 class="text-base font-semibold">
          {{ trial.title }}
        </h3>
        <p class="muted text-sm leading-6 mt-2">
          {{ trial.objective }}
        </p>
      </div>
      <BaseBadge :tone="trial.status === 'completed' ? 'success' : trial.status === 'active' ? 'accent' : 'warning'">
        {{ formatTrialStatus(trial.status) }}
      </BaseBadge>
    </div>

    <p class="muted text-sm">
      {{ buildTrialStatusCopy(trial) }}
    </p>

    <div class="text-sm gap-2 grid">
      <div><span class="font-semibold">Scope:</span> <span class="muted">{{ trial.scope }}</span></div>
      <div><span class="font-semibold">Cadence:</span> <span class="muted">{{ trial.checkInCadence }}</span></div>
    </div>

    <div>
      <h4 class="text-sm font-semibold">
        Deliverables
      </h4>
      <ul class="muted text-sm leading-6 mt-2 gap-2 grid">
        <li v-for="deliverable in trial.deliverables" :key="deliverable">
          {{ deliverable }}
        </li>
      </ul>
    </div>

    <div>
      <h4 class="text-sm font-semibold">
        Success signals
      </h4>
      <ul class="muted text-sm leading-6 mt-2 gap-2 grid">
        <li v-for="signal in trial.successSignals" :key="signal">
          {{ signal }}
        </li>
      </ul>
    </div>

    <div class="flex flex-wrap gap-2 items-center justify-between">
      <BaseBadge :tone="acknowledged ? 'success' : 'warning'">
        {{ acknowledged ? "Acknowledged" : "Needs acknowledgement" }}
      </BaseBadge>
      <slot />
    </div>
  </article>
</template>
