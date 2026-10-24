<script setup lang="ts">
import { buildActivationPlan } from "~/shared/utils/activation"
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
const activationPlan = computed(() => currentUserId.value ? buildActivationPlan(workspaceStore.data, currentUserId.value) : null)
const inboxSnapshot = computed(() => currentUserId.value ? buildInboxSnapshot(workspaceStore.data, currentUserId.value) : null)
const profileRecommendations = computed(() => profile.value ? recommendProfilesForProfile(workspaceStore.data, profile.value).slice(0, 3) : [])
const opportunityRecommendations = computed(() => profile.value ? recommendOpportunitiesForProfile(workspaceStore.data, profile.value).slice(0, 3) : [])
const showProfileRecommendations = computed(() => profile.value ? profile.value.hasIdea && !profile.value.wantsToJoinIdea : false)
const proposals = computed(() => currentUserId.value ? getProposalsForUser(workspaceStore.data, currentUserId.value).slice(0, 3) : [])
const matches = computed(() => currentUserId.value ? getMatchesForUser(workspaceStore.data, currentUserId.value).slice(0, 3) : [])
const contracts = computed(() => currentUserId.value ? getContractsForUser(workspaceStore.data, currentUserId.value).slice(0, 2) : [])
const trials = computed(() => currentUserId.value ? getTrialsForUser(workspaceStore.data, currentUserId.value).slice(0, 2) : [])
const notifications = computed(() => currentUserId.value
  ? workspaceStore.data.notifications
      .filter(notification => notification.userId === currentUserId.value && !notification.readAt)
      .slice(0, 4)
  : [])
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
const primaryAction = computed(() => {
  if (inboxSnapshot.value?.counts.pendingIntros) {
    return {
      title: `Review ${inboxSnapshot.value.counts.pendingIntros} inbound intro${inboxSnapshot.value.counts.pendingIntros === 1 ? "" : "s"}`,
      href: "/app/inbox",
      ctaLabel: "Open intro queue",
    }
  }

  if (inboxSnapshot.value?.counts.contractsNeedingSignature) {
    return {
      title: "Finish the waiting agreement signature",
      href: "/app/inbox",
      ctaLabel: "Open inbox",
    }
  }

  if (inboxSnapshot.value?.counts.proposalsNeedingResponse || inboxSnapshot.value?.counts.unreadConversations) {
    return {
      title: "Clear the active response queue",
      href: "/app/inbox",
      ctaLabel: "Open inbox",
    }
  }

  if (readiness.value && !readiness.value.readyForOutreach) {
    return {
      title: "Finish the missing profile signals",
      description: readiness.value.missingOutreachItems.length
        ? `Still missing: ${readiness.value.missingOutreachItems.join(", ")}.`
        : "Outreach requires a completed profile.",
      href: "/app/profile/edit",
      ctaLabel: "Finish profile",
    }
  }

  if (matches.value.length) {
    return {
      title: "Move one match into a trial sprint",
      href: "/app/matches",
      ctaLabel: "Open matches",
    }
  }

  if (proposals.value.length) {
    return {
      title: "Close open proposal sections",
      href: "/app/proposals",
      ctaLabel: "Open proposals",
    }
  }

  return {
    title: "Recommended matches",
    href: "/app/discover",
    ctaLabel: "Open discover",
  }
})
const hasActiveWork = computed(() => Boolean(
  inboxSnapshot.value?.actions.length
  || incomingRequests.value.length
  || outgoingRequests.value.length
  || trials.value.length
  || proposals.value.length
  || contracts.value.length,
))
const hasLiveFollowUp = computed(() => Boolean(notifications.value.length))

function skillLabels(profileId: string) {
  return getProfileSkills(workspaceStore.data, profileId).map(item => item.skill.label)
}

async function acceptConnectRequest(requestId: string) {
  const conversationId = await workspaceStore.respondToConnectRequest(requestId, "accepted")
  toastStore.push({
    title: "Intro accepted",
    message: "Messaging is unlocked.",
    tone: "success",
  })

  if (conversationId)
    navigateTo(`/app/messages/${conversationId}`)
}

async function declineConnectRequest(requestId: string, reason: "timing" | "domain_mismatch" | "commitment_mismatch" | "values_mismatch" | "role_mismatch") {
  await workspaceStore.respondToConnectRequest(requestId, "declined", reason)
  toastStore.push({
    title: "Intro closed",
    message: "Your decline reason was shared with the sender.",
    tone: "info",
  })
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      title="Overview"
    >
      <template #actions>
        <BaseBadge tone="accent">
          {{ formatPlanName(subscription?.plan || "free") }} plan
        </BaseBadge>
      </template>
    </PageIntro>

    <section class="panel panel-emphasis p-6 flex flex-col gap-5 md:p-7 md:flex-row md:items-center md:justify-between" aria-labelledby="overview-next-step">
      <div>
        <p class="section-kicker">
          Your next step
        </p>
        <h2 id="overview-next-step" class="text-xl leading-snug font-semibold mt-2 md:text-2xl">
          {{ primaryAction.title }}
        </h2>
        <p v-if="primaryAction.description" class="muted measure leading-7 mt-2">
          {{ primaryAction.description }}
        </p>
      </div>
      <BaseButton size="lg" :to="primaryAction.href" class="shrink-0">
        {{ primaryAction.ctaLabel }}
        <span class="i-carbon-arrow-right" aria-hidden="true" />
      </BaseButton>
    </section>

    <ActivationCockpit v-if="activationPlan" :plan="activationPlan" compact />

    <div class="gap-5 grid md:gap-6" :class="hasLiveFollowUp ? 'xl:grid-cols-[1.15fr_0.85fr]' : ''">
      <section class="gap-5 grid">
        <div v-if="!hasActiveWork" class="gap-5 grid order-1">
          <PageIntro
            :eyebrow="showProfileRecommendations ? 'Recommended collaborators' : 'Recommended opportunities'"
            :heading-level="2"
            title="Best next conversations"
          />

          <div v-if="showProfileRecommendations && profileRecommendations.length" class="gap-4 grid lg:grid-cols-2">
            <ProfileCard
              v-for="item in profileRecommendations"
              :key="item.profile.id"
              :profile="item.profile"
              :skills="skillLabels(item.profile.id)"
            >
              <BaseButton variant="secondary" to="/app/discover">
                Review collaborator
              </BaseButton>
              <p class="muted text-xs ml-auto self-center">
                {{ [`Match ${item.score}`, item.reciprocityScore >= 6 ? "Likely reply" : "", item.localBias ? "Local-first" : ""].filter(Boolean).join(" · ") }}
              </p>
            </ProfileCard>
          </div>

          <div v-else-if="opportunityRecommendations.length" class="gap-4 grid lg:grid-cols-2">
            <OpportunityCard
              v-for="item in opportunityRecommendations"
              :key="item.opportunity.id"
              :opportunity="item.opportunity"
            >
              <BaseButton variant="secondary" :to="`/app/opportunities/${item.opportunity.id}`">
                View opportunity
              </BaseButton>
              <p class="muted text-xs ml-auto self-center">
                Match {{ item.score }}
              </p>
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
        </div>

        <div class="panel p-5" :class="hasActiveWork ? 'order-1' : 'order-2'">
          <div class="flex flex-wrap gap-3 items-start justify-between">
            <div>
              <p class="section-kicker">
                Formation pipeline
              </p>
              <h2 class="text-xl font-semibold mt-2">
                Move one relationship forward.
              </h2>
              <p class="muted text-sm leading-6 mt-3">
                Keep intros, trial sprints, and written terms in sequence.
              </p>
            </div>
            <BaseBadge tone="neutral">
              {{ incomingRequests.length + outgoingRequests.length }} open intro{{ incomingRequests.length + outgoingRequests.length === 1 ? "" : "s" }}
            </BaseBadge>
          </div>

          <div class="surface-row-list mt-5">
            <section v-if="incomingRequests.length" class="surface-row">
              <div class="flex flex-wrap gap-3 items-center justify-between">
                <h3 class="text-base font-semibold">
                  Incoming intros
                </h3>
                <BaseBadge :tone="incomingRequests.length ? 'accent' : 'neutral'">
                  {{ incomingRequests.length || "None" }}
                </BaseBadge>
              </div>
              <ConnectRequestInbox
                v-if="incomingRequests.length"
                class="mt-4"
                mode="incoming"
                :items="incomingRequests"
                @accept="acceptConnectRequest"
                @decline="declineConnectRequest"
              />
            </section>

            <section v-if="outgoingRequests.length" class="surface-row">
              <div class="flex flex-wrap gap-3 items-center justify-between">
                <h3 class="text-base font-semibold">
                  Outgoing intros
                </h3>
                <BaseBadge :tone="outgoingRequests.length ? 'accent' : 'neutral'">
                  {{ outgoingRequests.length || "None" }}
                </BaseBadge>
              </div>
              <ConnectRequestInbox
                v-if="outgoingRequests.length"
                class="mt-4"
                mode="outgoing"
                :items="outgoingRequests"
              />
            </section>

            <section v-if="trials.length" class="surface-row">
              <div class="flex flex-wrap gap-3 items-center justify-between">
                <h3 class="text-base font-semibold">
                  Trial sprint
                </h3>
                <BaseBadge :tone="trials.length ? 'accent' : 'neutral'">
                  {{ trials.length ? `${trials.length} active` : "Not started" }}
                </BaseBadge>
              </div>
              <div v-if="trials.length" class="mt-4 gap-4 grid">
                <TrialCollaborationCard
                  v-for="trial in trials"
                  :key="trial.id"
                  :trial="trial"
                  :acknowledged="trial.acknowledgedByUserIds.includes(currentUserId)"
                  compact
                >
                  <BaseButton variant="secondary" to="/app/matches">
                    Open trial details
                  </BaseButton>
                </TrialCollaborationCard>
              </div>
            </section>

            <section v-if="!incomingRequests.length && !outgoingRequests.length && !trials.length" class="surface-row flex flex-col gap-4 items-start sm:flex-row sm:items-center sm:justify-between">
              <p class="muted text-sm leading-6">
                No intro or trial is currently active. Pick one strong fit before opening more conversations.
              </p>
              <BaseButton variant="secondary" to="/app/discover">
                Open discover
              </BaseButton>
            </section>
          </div>
        </div>
      </section>

      <section v-if="hasLiveFollowUp" class="gap-5 grid">
        <div v-if="notifications.length" class="panel p-5">
          <h2 class="text-lg font-semibold">
            Unread notifications
            <span class="muted text-sm font-normal ml-1">{{ notifications.length }}</span>
          </h2>
          <div class="surface-row-list mt-5">
            <NuxtLink
              v-for="notification in notifications"
              :key="notification.id"
              :to="notification.href"
              class="surface-row group flex gap-3 items-start justify-between"
            >
              <div class="min-w-0">
                <p class="text-sm font-semibold group-hover:text-[var(--accent-strong)]">
                  {{ notification.title }}
                </p>
                <p class="muted text-sm leading-6 mt-1 line-clamp-2">
                  {{ notification.body }}
                </p>
              </div>
              <span class="i-carbon-chevron-right muted mt-1 shrink-0" aria-hidden="true" />
            </NuxtLink>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
