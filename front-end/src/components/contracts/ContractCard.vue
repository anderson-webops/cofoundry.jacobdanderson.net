<script setup lang="ts">
import type { Contract, ContractVersion } from "~/shared/types/domain"
import { formatContractStatus } from "~/shared/utils/format"

defineProps<{
  contract: Contract
  version?: ContractVersion
  href: string
}>()
</script>

<template>
  <NuxtLink :to="href" class="panel p-5 block transition hover:-translate-y-0.5">
    <div class="flex gap-4 items-start justify-between">
      <div>
        <h3 class="text-lg font-semibold">
          {{ contract.title }}
        </h3>
        <p class="muted text-sm mt-2">
          Version {{ version?.versionNumber || 1 }} · {{ version?.roleTitle }}
        </p>
      </div>
      <BaseBadge :tone="contract.status === 'signed' ? 'success' : 'accent'">
        {{ formatContractStatus(contract.status) }}
      </BaseBadge>
    </div>
    <p class="muted text-sm leading-6 mt-4">
      {{ version?.notes }}
    </p>
  </NuxtLink>
</template>
