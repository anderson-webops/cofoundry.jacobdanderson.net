<script setup lang="ts">
import { getCurrentProposalVersion, getProposalsForUser } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Proposals")

const { authStore, workspaceStore } = useCurrentMember()

const proposals = computed(() => authStore.currentUser ? getProposalsForUser(workspaceStore.data, authStore.currentUser.id) : [])
const activeCount = computed(() => proposals.value.filter(proposal => proposal.status !== "accepted" && proposal.status !== "rejected").length)
const agreementReadyCount = computed(() => proposals.value.filter(proposal => proposal.status === "accepted").length)
const counterCount = computed(() => proposals.value.filter(proposal => proposal.status === "countered").length)
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Deal rooms"
      title="Run the negotiation in one place"
      description="These proposal rooms hold the real formation work: trial scope, economics, decision rights, IP, and the off-ramp before either side reaches for a formal agreement."
    />

    <div class="gap-4 grid md:grid-cols-3">
      <MetricTile label="Active rooms" :value="activeCount" context="Proposal threads that still need movement toward a clean yes or no." />
      <MetricTile label="Counter cycles" :value="counterCount" context="Sections that have live negotiation pressure and should not stay vague." />
      <MetricTile label="Agreement-ready" :value="agreementReadyCount" context="Accepted proposals that can roll cleanly into an editable agreement draft." />
    </div>

    <div class="panel p-6">
      <h2 class="text-xl font-semibold">
        What belongs here
      </h2>
      <div class="mt-5 gap-4 grid md:grid-cols-3">
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            Partnership shape
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Relationship type, full-time trigger, and who owns the CEO or lead operator role.
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            Trial and economics
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Work trial scope, trial IP handling, cash bridge, equity, vesting, and cliff.
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            Governance and exit
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Decision rights, confidentiality, and the off-ramp if the working relationship fails the test.
          </p>
        </div>
      </div>
    </div>

    <div v-if="proposals.length" class="gap-4 grid lg:grid-cols-2">
      <ProposalCard
        v-for="proposal in proposals"
        :key="proposal.id"
        :proposal="proposal"
        :version="getCurrentProposalVersion(workspaceStore.data, proposal)"
        :href="`/app/proposals/${proposal.id}`"
      />
    </div>

    <EmptyState
      v-else
      icon="i-carbon-document-signed"
      title="No deal rooms yet"
      description="Start from a matched conversation once the first call and trial sprint have produced enough clarity to propose real terms."
    >
      <BaseButton to="/app/messages">
        Open messages
      </BaseButton>
    </EmptyState>
  </div>
</template>
