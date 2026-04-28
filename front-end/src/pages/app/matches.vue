<script setup lang="ts">
import { formatDate } from "~/shared/utils/format"
import { buildParticipantProfiles, getConversationByMatch, getMatchesForUser, getProfileByUserId, getTrialForMatch } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Matches")

const toastStore = useToastStore()
const { authStore, workspaceStore } = useCurrentMember()
const currentUserId = computed(() => authStore.currentUser?.id || "")
const currentProfile = computed(() => currentUserId.value ? getProfileByUserId(workspaceStore.data, currentUserId.value) : null)

const matches = computed(() => authStore.currentUser ? getMatchesForUser(workspaceStore.data, authStore.currentUser.id) : [])

function matchPartner(match: ReturnType<typeof getMatchesForUser>[number]) {
  if (!authStore.currentUser)
    return null

  const profiles = buildParticipantProfiles(workspaceStore.data, match.participantIds)
  return profiles.find(item => item.userId !== authStore.currentUser?.id) || null
}

function latestPreview(match: ReturnType<typeof getMatchesForUser>[number]) {
  const conversation = getConversationByMatch(workspaceStore.data, match)
  return conversation ? workspaceStore.getConversationPreview(conversation.id)?.body : ""
}

function trialForMatch(match: ReturnType<typeof getMatchesForUser>[number]) {
  return getTrialForMatch(workspaceStore.data, match.id)
}

async function startTrial(match: ReturnType<typeof getMatchesForUser>[number]) {
  if (!currentUserId.value)
    return

  await workspaceStore.startTrialCollaboration(match.id, currentUserId.value)
  toastStore.push({
    title: "Trial started",
    message: "A short working sprint was attached to the match so you can pressure-test the relationship before final terms.",
    tone: "success",
  })
}

async function acknowledgeTrial(match: ReturnType<typeof getMatchesForUser>[number]) {
  if (!currentUserId.value)
    return

  const trial = trialForMatch(match)
  if (!trial)
    return

  await workspaceStore.acknowledgeTrialCollaboration(trial.id, currentUserId.value)
  toastStore.push({
    title: "Trial acknowledged",
    message: "Your acknowledgement was recorded on the sprint plan.",
    tone: "success",
  })
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Matches"
      title="Mutual interest unlocks messaging."
      description="Founders and collaborators only get direct access after both sides opt in. From there, CoFoundry helps you run the first call, start a short trial, and only then move into proposal terms."
    />

    <div v-if="matches.length" class="gap-5 grid">
      <article v-for="match in matches" :key="match.id" class="panel p-6 gap-5 grid">
        <div class="flex gap-4 items-start justify-between">
          <div>
            <h2 class="text-xl font-semibold">
              {{ matchPartner(match)?.displayName }}
            </h2>
            <p class="muted text-sm mt-2">
              {{ matchPartner(match)?.headline }}
            </p>
          </div>
          <BaseBadge tone="accent">
            Match
          </BaseBadge>
        </div>
        <TrustSignalStrip v-if="matchPartner(match)" :profile="matchPartner(match)!" />
        <p class="muted text-sm leading-6 mt-4">
          {{ latestPreview(match) }}
        </p>

        <div class="gap-4 grid lg:grid-cols-[0.95fr_1.05fr]">
          <details class="panel-inset p-5">
            <summary class="text-base font-semibold cursor-pointer">
              First-call agenda
            </summary>
            <div class="mt-4">
              <FirstCallAgenda :profile="matchPartner(match)" />
            </div>
          </details>

          <TrialCollaborationCard
            v-if="trialForMatch(match)"
            :trial="trialForMatch(match)!"
            :acknowledged="trialForMatch(match)!.acknowledgedByUserIds.includes(currentUserId)"
          >
            <div class="flex flex-wrap gap-3">
              <BaseButton
                v-if="!trialForMatch(match)!.acknowledgedByUserIds.includes(currentUserId)"
                variant="secondary"
                @click="acknowledgeTrial(match)"
              >
                Acknowledge trial
              </BaseButton>
              <BaseButton :to="`/app/messages/${match.conversationId}`">
                Open conversation
              </BaseButton>
            </div>
          </TrialCollaborationCard>

          <div v-else class="panel-inset p-5">
            <h3 class="text-base font-semibold">
              Start a short working sprint
            </h3>
            <p class="muted text-sm leading-6 mt-3">
              Run a two-week alignment sprint before the proposal gets heavy. It is the fastest way to uncover commitment or decision-rights mismatches while the cost is still low.
            </p>
            <div class="mt-4 flex flex-wrap gap-3">
              <BaseButton @click="startTrial(match)">
                Start trial
              </BaseButton>
              <BaseButton variant="secondary" :to="`/app/messages/${match.conversationId}`">
                Open conversation
              </BaseButton>
            </div>
          </div>
        </div>

        <details v-if="currentProfile && matchPartner(match)" class="panel-inset p-5">
          <summary class="text-base font-semibold cursor-pointer">
            Alignment check
          </summary>
          <div class="mt-4">
            <AlignmentCheckPanel
              :current-profile="currentProfile"
              :counterpart-profile="matchPartner(match)!"
            />
          </div>
        </details>

        <div class="mt-1">
          <span class="muted text-sm">Matched on {{ formatDate(match.createdAt) }}</span>
        </div>
      </article>
    </div>

    <EmptyState
      v-else
      icon="i-carbon-ibm-cloud-direct-link-1"
      title="No matches yet"
      description="Send a few focused connect requests or express interest in an opportunity to start opening conversations."
    >
      <BaseButton to="/app/discover">
        Go to discovery
      </BaseButton>
    </EmptyState>
  </div>
</template>
