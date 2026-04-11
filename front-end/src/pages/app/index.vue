<script setup lang="ts">
import { formatPlanName } from "~/shared/utils/format"
import { buildRecommendationCards, getContractsForUser, getMatchesForUser, getProposalsForUser } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Workspace")

const { authStore, profile, subscription, workspaceStore } = useCurrentMember()
const currentUserId = computed(() => authStore.currentUser?.id || "")

const recommendations = computed(() => currentUserId.value ? buildRecommendationCards(workspaceStore.data, currentUserId.value).slice(0, 3) : [])
const proposals = computed(() => currentUserId.value ? getProposalsForUser(workspaceStore.data, currentUserId.value).slice(0, 3) : [])
const matches = computed(() => currentUserId.value ? getMatchesForUser(workspaceStore.data, currentUserId.value).slice(0, 3) : [])
const contracts = computed(() => currentUserId.value ? getContractsForUser(workspaceStore.data, currentUserId.value).slice(0, 2) : [])
const notifications = computed(() => currentUserId.value ? workspaceStore.data.notifications.filter(notification => notification.userId === currentUserId.value).slice(0, 4) : [])

function getProposalVersion(proposalId: string) {
  const proposal = workspaceStore.data.proposals.find(item => item.id === proposalId)
  return proposal ? workspaceStore.data.proposalVersions.find(version => version.id === proposal.currentVersionId) : undefined
}

function getContractVersion(contractId: string) {
  const contract = workspaceStore.data.contracts.find(item => item.id === contractId)
  return contract ? workspaceStore.data.contractVersions.find(version => version.id === contract.currentVersionId) : undefined
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Workspace"
      :title="`Welcome back, ${profile?.displayName || authStore.currentUser?.name || 'there'}.`"
      description="Your dashboard pulls together the people, opportunities, proposals, and contracts that need action right now."
    >
      <template #actions>
        <BaseBadge tone="accent">
          {{ formatPlanName(subscription?.plan || "free") }} plan
        </BaseBadge>
      </template>
    </PageIntro>

    <div class="gap-4 grid md:grid-cols-4">
      <MetricTile label="Profile completion" :value="profile?.verificationBadges.profileComplete ? '100%' : '70%'" context="Complete profiles surface more often in discovery." />
      <MetricTile label="Matches" :value="matches.length" context="Mutual connections that unlock messaging." />
      <MetricTile label="Active proposals" :value="proposals.length" context="Structured collaboration terms in motion." />
      <MetricTile label="Contracts" :value="contracts.length" context="Editable agreement drafts and signed versions." />
    </div>

    <div class="gap-6 grid xl:grid-cols-[1.15fr_0.85fr]">
      <section class="gap-4 grid">
        <PageIntro
          eyebrow="Recommended opportunities"
          title="Best next conversations"
          description="These are ranked from your profile signal, stage preferences, and compensation fit."
        />

        <div v-if="recommendations.length" class="gap-4 grid lg:grid-cols-2">
          <OpportunityCard
            v-for="item in recommendations"
            :key="item.opportunity.id"
            :opportunity="item.opportunity"
          >
            <BaseBadge tone="accent">
              Match score {{ item.score }}
            </BaseBadge>
            <BaseButton variant="secondary" :to="`/app/opportunities/${item.opportunity.id}`">
              View opportunity
            </BaseButton>
          </OpportunityCard>
        </div>
        <EmptyState
          v-else
          icon="i-carbon-search"
          title="No recommendations yet"
          description="Complete your profile and set your stage, compensation, and role preferences to unlock better matching."
        >
          <BaseButton to="/app/profile/edit">
            Finish profile
          </BaseButton>
        </EmptyState>
      </section>

      <section class="gap-4 grid">
        <div class="panel p-5">
          <h2 class="text-lg font-semibold">
            Recent notifications
          </h2>
          <div class="mt-5 gap-3 grid">
            <div v-for="notification in notifications" :key="notification.id" class="p-4 border border-[var(--line)] rounded-[1.25rem]">
              <div class="flex gap-3 items-start justify-between">
                <div>
                  <p class="text-sm font-semibold">
                    {{ notification.title }}
                  </p>
                  <p class="muted text-sm leading-6 mt-1">
                    {{ notification.body }}
                  </p>
                </div>
                <BaseBadge :tone="notification.readAt ? 'neutral' : 'accent'">
                  {{ notification.readAt ? "Read" : "New" }}
                </BaseBadge>
              </div>
              <div class="mt-4">
                <BaseButton variant="ghost" :to="notification.href">
                  Open
                </BaseButton>
              </div>
            </div>
          </div>
        </div>

        <div class="panel p-5">
          <h2 class="text-lg font-semibold">
            Active proposals
          </h2>
          <div class="mt-5 gap-3 grid">
            <ProposalCard
              v-for="proposal in proposals"
              :key="proposal.id"
              :proposal="proposal"
              :version="getProposalVersion(proposal.id)"
              :href="`/app/proposals/${proposal.id}`"
            />
          </div>
        </div>

        <div class="panel p-5">
          <h2 class="text-lg font-semibold">
            Contract drafts
          </h2>
          <div class="mt-5 gap-3 grid">
            <ContractCard
              v-for="contract in contracts"
              :key="contract.id"
              :contract="contract"
              :version="getContractVersion(contract.id)"
              :href="`/app/contracts/${contract.id}`"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
