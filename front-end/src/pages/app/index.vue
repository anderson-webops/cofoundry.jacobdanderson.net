<script setup lang="ts">
import { recommendOpportunitiesForProfile, recommendProfilesForProfile } from "~/shared/utils/discovery"
import { formatPlanName } from "~/shared/utils/format"
import { buildProfileReadiness, buildProfileTrustScore } from "~/shared/utils/formation"
import { getContractsForUser, getMatchesForUser, getProfileSkills, getProposalsForUser, getTrialsForUser } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Workspace")

const { authStore, profile, subscription, workspaceStore } = useCurrentMember()
const currentUserId = computed(() => authStore.currentUser?.id || "")

const readiness = computed(() => profile.value ? buildProfileReadiness(profile.value) : null)
const profileRecommendations = computed(() => profile.value ? recommendProfilesForProfile(workspaceStore.data, profile.value).slice(0, 3) : [])
const opportunityRecommendations = computed(() => profile.value ? recommendOpportunitiesForProfile(workspaceStore.data, profile.value).slice(0, 3) : [])
const showProfileRecommendations = computed(() => profile.value ? profile.value.hasIdea && !profile.value.wantsToJoinIdea : false)
const proposals = computed(() => currentUserId.value ? getProposalsForUser(workspaceStore.data, currentUserId.value).slice(0, 3) : [])
const matches = computed(() => currentUserId.value ? getMatchesForUser(workspaceStore.data, currentUserId.value).slice(0, 3) : [])
const contracts = computed(() => currentUserId.value ? getContractsForUser(workspaceStore.data, currentUserId.value).slice(0, 2) : [])
const trials = computed(() => currentUserId.value ? getTrialsForUser(workspaceStore.data, currentUserId.value).slice(0, 2) : [])
const notifications = computed(() => currentUserId.value ? workspaceStore.data.notifications.filter(notification => notification.userId === currentUserId.value).slice(0, 4) : [])
const trustScore = computed(() => profile.value ? buildProfileTrustScore(profile.value) : 0)

function skillLabels(profileId: string) {
  return getProfileSkills(workspaceStore.data, profileId).map(item => item.skill.label)
}

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
      <MetricTile label="Profile completion" :value="`${readiness?.percent || 0}%`" context="The stronger the profile, the faster CoFoundry can unlock outreach and proposals." />
      <MetricTile label="Trust score" :value="trustScore" context="Combines proof of work, verification, recency, and response speed." />
      <MetricTile label="Matches" :value="matches.length" context="Mutual connections that unlock messaging." />
      <MetricTile label="Active trials" :value="trials.length" context="Short working sprints that de-risk the relationship before signatures." />
    </div>

    <div class="gap-6 grid xl:grid-cols-[1.15fr_0.85fr]">
      <section class="gap-4 grid">
        <PageIntro
          :eyebrow="showProfileRecommendations ? 'Recommended collaborators' : 'Recommended opportunities'"
          title="Best next conversations"
          :description="showProfileRecommendations
            ? 'These people are ranked from intent alignment, operating fit, and trust signal.'
            : 'These opportunities are ranked from your profile signal, stage preferences, and compensation fit.'"
        />

        <div v-if="showProfileRecommendations && profileRecommendations.length" class="gap-4 grid lg:grid-cols-2">
          <ProfileCard
            v-for="item in profileRecommendations"
            :key="item.profile.id"
            :profile="item.profile"
            :skills="skillLabels(item.profile.id)"
          >
            <BaseBadge tone="accent">
              Match score {{ item.score }}
            </BaseBadge>
            <BaseButton variant="secondary" to="/app/discover">
              Review collaborator
            </BaseButton>
          </ProfileCard>
        </div>

        <div v-else-if="opportunityRecommendations.length" class="gap-4 grid lg:grid-cols-2">
          <OpportunityCard
            v-for="item in opportunityRecommendations"
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

        <PageIntro
          eyebrow="Formation workflow"
          title="Run a short trial before the terms get heavy."
          description="The research was consistent here: strong founder matches still fail when nobody pressure-tests working style, decision rights, or pace before equity enters the room."
        />

        <div v-if="trials.length" class="gap-4 grid">
          <TrialCollaborationCard
            v-for="trial in trials"
            :key="trial.id"
            :trial="trial"
            :acknowledged="trial.acknowledgedByUserIds.includes(currentUserId)"
          >
            <BaseButton variant="secondary" to="/app/matches">
              Open match workflow
            </BaseButton>
          </TrialCollaborationCard>
        </div>
        <div v-else class="panel p-5">
          <p class="text-sm font-semibold">
            No active trial sprints yet
          </p>
          <p class="muted text-sm leading-6 mt-3">
            Start from a mutual match, run one small working sprint, and only then move into a formal proposal or agreement.
          </p>
          <div class="mt-4">
            <BaseButton to="/app/matches">
              Open matches
            </BaseButton>
          </div>
        </div>
      </section>

      <section class="gap-4 grid">
        <ActivationCockpit
          v-if="profile"
          :profile="profile"
          :preview-count="showProfileRecommendations ? profileRecommendations.length : opportunityRecommendations.length"
          :match-count="matches.length"
          :proposal-count="proposals.length"
        />

        <IntentChecklistPanel v-if="profile" :profile="profile" />

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
