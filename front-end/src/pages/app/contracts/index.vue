<script setup lang="ts">
import { getContractsForUser, getCurrentContractVersion } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Contracts")

const { authStore, workspaceStore } = useCurrentMember()

const contracts = computed(() => authStore.currentUser ? getContractsForUser(workspaceStore.data, authStore.currentUser.id) : [])
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Contracts"
      title="Agreement templates generated from accepted proposals."
      description="These are editable templates with typed-name signatures and timestamps. They are not legal advice and should be reviewed by counsel."
    />

    <div v-if="contracts.length" class="gap-4 grid lg:grid-cols-2">
      <ContractCard
        v-for="contract in contracts"
        :key="contract.id"
        :contract="contract"
        :version="getCurrentContractVersion(workspaceStore.data, contract)"
        :href="`/app/contracts/${contract.id}`"
      />
    </div>

    <EmptyState
      v-else
      icon="i-carbon-license-global"
      title="No contracts yet"
      description="Accepted proposals can be turned into editable agreement drafts from the proposal detail page."
    >
      <BaseButton to="/app/proposals">
        Review proposals
      </BaseButton>
    </EmptyState>
  </div>
</template>
