<script setup lang="ts">
import { recommendOpportunitiesForProfile, recommendProfilesForProfile } from "~/shared/utils/discovery"
import { formatPlanName } from "~/shared/utils/format"
import { buildProfileReadiness } from "~/shared/utils/formation"
import { buildInboxSnapshot } from "~/shared/utils/inbox"
import { getContractsForUser, getIncomingConnectRequestsForUser, getMatchesForUser, getOutgoingConnectRequestsForUser, getProfileByUserId, getProfileSkills, getProposalsForUser, getTrialsForUser } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Workspace")

const toastStore = useToastStore()
const { authStore, profile, subscription, workspaceStore } = useCurrentMember()
const currentUserId = computed(() => authStore.currentUser?.id || "")

const readiness = computed(() => profile.value ? buildProfileReadiness(profile.value) : null)
const inboxSnapshot = computed(() => currentUserId.value ? buildInboxSnapshot(workspaceStore.data, currentUserId.value) : null)
const profileRecommendations = computed(() => profile.value ? recommendProfilesForProfile(workspaceStore.data, profile.value).slice(0, 3) : [])
const opportunityRecommendations = computed(() => profile.value ? recommendOpportunitiesForProfile(workspaceStore.data, profile.value).slice(0, 3) : [])
const showProfileRecommendations = computed(() => profile.value ? profile.value.hasIdea && !profile.value.wantsToJoinIdea : false)
const proposals = computed(() => currentUserId.value ? getProposalsForUser(workspaceStore.data, currentUserId.value).slice(0, 3) : [])
const matches = computed(() => currentUserId.value ? getMatchesForUser(workspaceStore.data, currentUserId.value).slice(0, 3) : [])
const contracts = computed(() => currentUserId.value ? getContractsForUser(workspaceStore.data, currentUserId.value).slice(0, 2) : [])
const trials = computed(() => currentUserId.value ? getTrialsForUser(workspaceStore.data, currentUserId.value).slice(0, 2) : [])
const notifications = computed(() => currentUserId.value ? workspaceStore.data.notifications.filter(notification => notification.userId === currentUserId.value).slice(0, 4) : [])
const incomingRequests = computed(() => {
  if (!currentUserId.value)
    return []

  return getIncomingConnectRequestsForUser(workspaceStore.data, currentUserId.value)
    .filter(request => request.status === "pending")
    .map((request) => {
      const counterpart = getProfileByUserId(workspaceStore.data, request.fromUserId)
      return counterpart ? { request, counterpart } : null
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
})
const outgoingRequests = computed(() => {
  if (!currentUserId.value)
    return []

  return getOutgoingConnectRequestsForUser(workspaceStore.data, currentUserId.value)
    .filter(request => request.status === "pending")
    .map((request) => {
      const counterpart = getProfileByUserId(workspaceStore.data, request.toUserId)
      return counterpart ? { request, counterpart } : null
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
})
const workspaceStage = computed(() => {
  if (contracts.value.length)
    return { label: "Agreement stage", tone: "success" as const, summary: "You already have agreement drafts in motion. Focus on finishing the active legal path instead of opening more threads." }

  if (proposals.value.length)
    return { label: "Terms taking shape", tone: "accent" as const, summary: "At least one relationship has moved beyond chat. Keep the deal room moving and close open sections quickly." }

  if (matches.value.length || trials.value.length)
    return { label: "Qualified conversations", tone: "accent" as const, summary: "You have enough signal to pressure-test working style. Use a trial sprint before adding heavier terms." }

  if (incomingRequests.value.length || outgoingRequests.value.length)
    return { label: "Active search", tone: "warning" as const, summary: "Discovery is live. The biggest risk now is leaving intros unanswered or letting follow-through stall." }

  if (readiness.value?.readyForOutreach)
    return { label: "Ready to reach out", tone: "success" as const, summary: "Your profile is clear enough to start a focused search. Pick the narrowest wedge that could convert." }

  return { label: "Profile still gating outreach", tone: "warning" as const, summary: "The next gain in match quality comes from tightening profile signal before sending more intros." }
})
const primaryAction = computed(() => {
  if (inboxSnapshot.value?.counts.pendingIntros) {
    return {
      title: `Review ${inboxSnapshot.value.counts.pendingIntros} inbound intro${inboxSnapshot.value.counts.pendingIntros === 1 ? "" : "s"}`,
      description: "Replying quickly is the fastest way to improve marketplace trust and keep strong conversations alive.",
      href: "/app/inbox",
      ctaLabel: "Open intro queue",
    }
  }

  if (inboxSnapshot.value?.counts.contractsNeedingSignature) {
    return {
      title: "Finish the waiting agreement signature",
      description: "The terms are already concrete enough to be in contract form. Do not let agreement drafts stall at the last step.",
      href: "/app/inbox",
      ctaLabel: "Open inbox",
    }
  }

  if (inboxSnapshot.value?.counts.proposalsNeedingResponse || inboxSnapshot.value?.counts.unreadConversations) {
    return {
      title: "Clear the active response queue",
      description: "The highest-leverage work is now inside live conversations and proposal rooms, not fresh browsing.",
      href: "/app/inbox",
      ctaLabel: "Open inbox",
    }
  }

  if (readiness.value && !readiness.value.readyForOutreach) {
    return {
      title: "Finish the missing profile signals",
      description: readiness.value.missingOutreachItems.length
        ? `Still missing: ${readiness.value.missingOutreachItems.join(", ")}.`
        : "Tighten the remaining trust and intent fields so outreach unlocks cleanly.",
      href: "/app/profile/edit",
      ctaLabel: "Finish profile",
    }
  }

  if (matches.value.length) {
    return {
      title: "Move one match into a trial sprint",
      description: "The highest-leverage next step is to test cadence, ownership, and decision style before negotiating terms.",
      href: "/app/matches",
      ctaLabel: "Open matches",
    }
  }

  if (proposals.value.length) {
    return {
      title: "Close open proposal sections",
      description: "Proposal momentum compounds. Move the live deal room forward before opening another one.",
      href: "/app/proposals",
      ctaLabel: "Open proposals",
    }
  }

  return {
    title: "Pick the next high-fit conversation",
    description: showProfileRecommendations.value
      ? "Your recommended collaborator set is already ranked for intent alignment and likely reply."
      : "Your recommended opportunity set is already ranked for role, stage, and compensation fit.",
    href: "/app/discover",
    ctaLabel: "Open discover",
  }
})
const statusCards = computed(() => [
  {
    title: "Pending on you",
    value: inboxSnapshot.value?.actions.length ? `${inboxSnapshot.value.actions.length} live item${inboxSnapshot.value.actions.length === 1 ? "" : "s"}` : "Nothing urgent",
    description: inboxSnapshot.value?.actions.length
      ? "The inbox now tracks direct replies, proposal responses, and signatures in one queue."
      : "Nothing is currently blocked on you across intros, messages, proposals, or contracts.",
  },
  {
    title: "Search state",
    value: outgoingRequests.value.length ? `${outgoingRequests.value.length} open outbound` : readiness.value?.readyForOutreach ? "Ready to search" : "Profile still gating",
    description: outgoingRequests.value.length
      ? "A few precise outbound intros are live. Keep scope tight until one converts."
      : readiness.value?.readyForOutreach
        ? "You can spend outreach on the strongest fits now."
        : "Profile clarity still matters more than sending more volume.",
  },
  {
    title: "Serious workflow",
    value: contracts.value.length ? `${contracts.value.length} agreement draft${contracts.value.length === 1 ? "" : "s"}` : proposals.value.length ? `${proposals.value.length} proposal${proposals.value.length === 1 ? "" : "s"}` : matches.value.length ? `${matches.value.length} match${matches.value.length === 1 ? "" : "es"}` : "Nothing live yet",
    description: contracts.value.length
      ? "You are already documenting the relationship in writing."
      : proposals.value.length
        ? "A structured deal room is open and should stay moving."
        : matches.value.length
          ? "Mutual interest exists, but it still needs a real working test."
          : "Discovery and intro quality still matter most.",
  },
])

function skillLabels(profileId: string) {
  return getProfileSkills(workspaceStore.data, profileId).map(item => item.skill.label)
}

function acceptConnectRequest(requestId: string) {
  const conversationId = workspaceStore.respondToConnectRequest(requestId, "accepted")
  toastStore.push({
    title: "Intro accepted",
    message: "Messaging is unlocked. Move straight into the proposed next step while intent is still fresh.",
    tone: "success",
  })

  if (conversationId)
    navigateTo(`/app/messages/${conversationId}`)
}

function declineConnectRequest(requestId: string, reason: "timing" | "domain_mismatch" | "commitment_mismatch" | "values_mismatch" | "role_mismatch") {
  workspaceStore.respondToConnectRequest(requestId, "declined", reason)
  toastStore.push({
    title: "Intro closed",
    message: "The other side now gets an explicit reason instead of silence.",
    tone: "info",
  })
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

    <div class="gap-4 grid xl:grid-cols-[1.1fr_0.9fr]">
      <div class="panel p-6">
        <div class="flex flex-wrap gap-3 items-center justify-between">
          <div>
            <p class="text-sm font-semibold">
              What needs attention next
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ workspaceStage.summary }}
            </p>
          </div>
          <BaseBadge :tone="workspaceStage.tone">
            {{ workspaceStage.label }}
          </BaseBadge>
        </div>

        <div class="panel-inset mt-5 p-5">
          <p class="text-lg font-semibold">
            {{ primaryAction.title }}
          </p>
          <p class="muted text-sm leading-6 mt-3">
            {{ primaryAction.description }}
          </p>
          <div class="mt-5">
            <BaseButton :to="primaryAction.href">
              {{ primaryAction.ctaLabel }}
            </BaseButton>
          </div>
        </div>
      </div>

      <div class="panel p-6">
        <h2 class="text-sm font-semibold">
          Current status
        </h2>
        <p class="muted text-sm leading-6 mt-2">
          This is the fastest read on what stage your workspace is in and where friction is still hiding.
        </p>
        <div class="mt-5 gap-3 grid">
          <div
            v-for="item in statusCards"
            :key="item.title"
            class="panel-inset p-4"
          >
            <div class="flex gap-3 items-start justify-between">
              <p class="text-sm font-semibold">
                {{ item.title }}
              </p>
              <BaseBadge tone="neutral">
                {{ item.value }}
              </BaseBadge>
            </div>
            <p class="muted text-sm leading-6 mt-3">
              {{ item.description }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="gap-4 grid md:grid-cols-4">
      <MetricTile label="Profile completion" :value="`${readiness?.percent || 0}%`" context="The stronger the profile, the faster CoFoundry can unlock outreach and proposals." />
      <MetricTile label="Trust-critical fields" :value="`${readiness?.trustPercent || 0}%`" context="Private ranking still exists, but members now see the evidence that drives credibility instead of a vanity score." />
      <MetricTile label="Matches" :value="matches.length" context="Mutual connections that unlock messaging." />
      <MetricTile label="Open intros" :value="incomingRequests.length + outgoingRequests.length" context="Pending requests that still need a real answer or follow-through." />
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
            <BaseBadge v-if="item.reciprocityScore >= 6" tone="success">
              Likely reply
            </BaseBadge>
            <BaseBadge v-if="item.localBias" tone="neutral">
              Local-first
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
          eyebrow="Intro queue"
          title="Close the loop quickly."
          description="Cold-start marketplaces die on ignored intros. Treat pending requests like real work: accept the credible ones, decline the wrong ones, and keep the other side out of ambiguity."
        />

        <div class="gap-4 grid lg:grid-cols-2">
          <div class="gap-4 grid">
            <h3 class="text-base font-semibold">
              Incoming intros
            </h3>
            <ConnectRequestInbox
              v-if="incomingRequests.length"
              mode="incoming"
              :items="incomingRequests"
              @accept="acceptConnectRequest"
              @decline="declineConnectRequest"
            />
            <div v-else class="panel p-5">
              <p class="text-sm font-semibold">
                Nothing waiting on you right now
              </p>
              <p class="muted text-sm leading-6 mt-3">
                Higher-signal profiles and public discovery pages make it easier for the right people to find you. When intros arrive, answer them quickly.
              </p>
            </div>
          </div>

          <div class="gap-4 grid">
            <h3 class="text-base font-semibold">
              Outgoing intros
            </h3>
            <ConnectRequestInbox
              v-if="outgoingRequests.length"
              mode="outgoing"
              :items="outgoingRequests"
            />
            <div v-else class="panel p-5">
              <p class="text-sm font-semibold">
                No open outbound intros
              </p>
              <p class="muted text-sm leading-6 mt-3">
                Keep the search focused. Strong wedges convert better than spraying requests across the whole market.
              </p>
            </div>
          </div>
        </div>

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
          <div v-if="notifications.length" class="mt-5 gap-3 grid">
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
          <EmptyState
            v-else
            icon="i-carbon-notification"
            title="Nothing new is waiting on you"
            description="When new intros, proposal updates, or moderation events happen, they will show up here with a direct path back into the workflow."
          >
            <BaseButton variant="secondary" to="/app/discover">
              Open discover
            </BaseButton>
          </EmptyState>
        </div>

        <div class="panel p-5">
          <h2 class="text-lg font-semibold">
            Active proposals
          </h2>
          <div v-if="proposals.length" class="mt-5 gap-3 grid">
            <ProposalCard
              v-for="proposal in proposals"
              :key="proposal.id"
              :proposal="proposal"
              :version="getProposalVersion(proposal.id)"
              :href="`/app/proposals/${proposal.id}`"
            />
          </div>
          <EmptyState
            v-else
            icon="i-carbon-document-signed"
            title="No live proposals yet"
            description="Keep proposal workflow reserved for the relationships that already survived a real fit check or trial sprint."
          >
            <BaseButton variant="secondary" to="/app/messages">
              Open messages
            </BaseButton>
          </EmptyState>
        </div>

        <div class="panel p-5">
          <h2 class="text-lg font-semibold">
            Contract drafts
          </h2>
          <div v-if="contracts.length" class="mt-5 gap-3 grid">
            <ContractCard
              v-for="contract in contracts"
              :key="contract.id"
              :contract="contract"
              :version="getContractVersion(contract.id)"
              :href="`/app/contracts/${contract.id}`"
            />
          </div>
          <EmptyState
            v-else
            icon="i-carbon-license-global"
            title="No agreement drafts yet"
            description="Agreements appear after a proposal is accepted and the relationship is ready to move into written terms."
          >
            <BaseButton variant="secondary" to="/app/proposals">
              Open proposals
            </BaseButton>
          </EmptyState>
        </div>
      </section>
    </div>
  </div>
</template>
