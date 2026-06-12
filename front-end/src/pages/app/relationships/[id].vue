<script setup lang="ts">
import type { RelationshipDecisionStatus, RelationshipSnapshot, RelationshipTimelineKind } from "~/shared/utils/relationships"
import { formatDate, formatRelativeDate } from "~/shared/utils/format"
import { getProfileByUserId } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Relationship workspace")

const route = useRoute()
const { authStore, workspaceStore } = useCurrentMember()
const matchId = computed(() => String(route.params.id || ""))
const requestHeaders = import.meta.server ? useRequestHeaders(["cookie"]) : undefined
const timelineFilter = ref<RelationshipTimelineKind | "all">("all")

const { data, error, pending, refresh } = await useAsyncData(
  `relationship:${matchId.value}`,
  () => $fetch<{ relationship: RelationshipSnapshot }>(`/api/relationships/${matchId.value}`, { headers: requestHeaders }),
)

const relationship = computed(() => data.value?.relationship || null)
const latestMessages = computed(() => [...(relationship.value?.latestMessages || [])].reverse())
const currentProfile = computed(() => authStore.currentUser ? getProfileByUserId(workspaceStore.data, authStore.currentUser.id) : null)
const timelineFilters = [
  { id: "all", label: "All" },
  { id: "message", label: "Messages" },
  { id: "proposal", label: "Proposals" },
  { id: "comment", label: "Comments" },
  { id: "contract", label: "Agreements" },
  { id: "signature", label: "Signatures" },
  { id: "trial", label: "Trial" },
  { id: "file", label: "Files" },
] satisfies Array<{ id: RelationshipTimelineKind | "all", label: string }>
const filteredTimeline = computed(() => {
  if (!relationship.value)
    return []

  if (timelineFilter.value === "all")
    return relationship.value.timeline

  return relationship.value.timeline.filter(entry => entry.kind === timelineFilter.value)
})

function senderLabel(senderUserId: string | null) {
  if (!senderUserId)
    return "System"

  if (senderUserId === authStore.currentUser?.id)
    return "You"

  return relationship.value?.counterpartProfile.displayName || "Counterpart"
}

function actorLabel(userId: string | null) {
  if (!userId)
    return "System"

  if (userId === authStore.currentUser?.id)
    return "You"

  return getProfileByUserId(workspaceStore.data, userId)?.displayName || "Member"
}

function timelineTone(kind: RelationshipTimelineKind) {
  return ({
    comment: "warning",
    contract: "accent",
    file: "neutral",
    message: "neutral",
    proposal: "accent",
    signature: "success",
    trial: "accent",
  } as const)[kind]
}

function decisionTone(status: RelationshipDecisionStatus) {
  return ({
    documented: "accent",
    open: "warning",
    proposed: "neutral",
    signed: "success",
  } as const)[status]
}

function scanTone(scanStatus: RelationshipSnapshot["files"][number]["scanStatus"]) {
  return ({
    blocked: "danger",
    clean: "success",
    failed: "danger",
    flagged: "danger",
    not_applicable: "neutral",
    pending: "warning",
    skipped: "neutral",
  } as const)[scanStatus]
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Relationship"
      :title="relationship ? relationship.counterpartProfile.displayName : 'Relationship workspace'"
      description="One working surface for the conversation, trial sprint, proposals, agreement draft, and next action."
    >
      <template #actions>
        <BaseButton variant="secondary" :disabled="pending" @click="refresh">
          {{ pending ? "Refreshing..." : "Refresh" }}
        </BaseButton>
      </template>
    </PageIntro>

    <EmptyState
      v-if="pending && !relationship"
      icon="i-carbon-ibm-cloud-direct-link-1"
      title="Loading relationship"
      description="Pulling the latest conversation, trial sprint, proposal, agreement, and next-action state."
    />

    <EmptyState
      v-else-if="error"
      icon="i-carbon-warning"
      title="Relationship unavailable"
      description="This relationship may have been removed, or your account may not be a participant."
    >
      <BaseButton to="/app/matches">
        Back to matches
      </BaseButton>
    </EmptyState>

    <template v-else-if="relationship">
      <div class="gap-5 grid xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
        <section class="gap-5 grid">
          <article class="panel p-6">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div>
                <h2 class="text-xl font-semibold">
                  Relationship timeline
                </h2>
                <p class="muted text-sm leading-6 mt-2">
                  A chronological view of messages, proposal movement, comments, files, trial events, and signatures.
                </p>
              </div>
              <BaseBadge tone="neutral">
                {{ relationship.timeline.length }} events
              </BaseBadge>
            </div>

            <div class="mt-5 pb-1 flex gap-2 overflow-x-auto">
              <button
                v-for="filter in timelineFilters"
                :key="filter.id"
                type="button"
                class="pill whitespace-nowrap"
                :class="timelineFilter === filter.id ? 'pill-active' : ''"
                @click="timelineFilter = filter.id"
              >
                {{ filter.label }}
              </button>
            </div>

            <div class="surface-row-list mt-5">
              <NuxtLink
                v-for="entry in filteredTimeline"
                :key="entry.id"
                :to="entry.href || undefined"
                class="surface-row block"
              >
                <div class="flex flex-wrap gap-2 items-center">
                  <BaseBadge :tone="timelineTone(entry.kind)">
                    {{ entry.kind }}
                  </BaseBadge>
                  <p class="text-sm font-semibold">
                    {{ entry.title }}
                  </p>
                </div>
                <p class="muted text-sm leading-6 mt-2">
                  {{ entry.summary }}
                </p>
                <p class="text-xs text-[var(--muted)] mt-3">
                  {{ actorLabel(entry.actorUserId) }} · {{ formatRelativeDate(entry.createdAt) }}
                </p>
              </NuxtLink>

              <EmptyState
                v-if="!filteredTimeline.length"
                icon="i-carbon-time"
                title="No events in this view"
                description="Switch filters to see the rest of the relationship history."
              />
            </div>
          </article>

          <article class="panel p-6">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div>
                <h2 class="text-xl font-semibold">
                  Conversation
                </h2>
                <p class="muted text-sm leading-6 mt-2">
                  {{ relationship.unreadCount }} unread message{{ relationship.unreadCount === 1 ? "" : "s" }} in this relationship.
                </p>
              </div>
              <BaseButton :to="`/app/messages/${relationship.conversationId}`">
                Open messages
              </BaseButton>
            </div>

            <div class="surface-row-list mt-5">
              <article v-for="message in latestMessages" :key="message.id" class="surface-row">
                <div class="flex flex-wrap gap-2 items-center">
                  <p class="text-sm font-semibold">
                    {{ senderLabel(message.senderUserId) }}
                  </p>
                  <BaseBadge :tone="message.type === 'system' ? 'neutral' : 'accent'">
                    {{ message.type }}
                  </BaseBadge>
                </div>
                <p class="muted text-sm leading-6 mt-2">
                  {{ message.body }}
                </p>
                <p class="text-xs text-[var(--muted)] mt-3">
                  {{ formatRelativeDate(message.createdAt) }}
                </p>
              </article>
            </div>
          </article>

          <article class="panel p-6">
            <h2 class="text-xl font-semibold">
              Proposals and agreements
            </h2>
            <div class="surface-row-list mt-5">
              <NuxtLink v-for="proposal in relationship.activeProposals" :key="proposal.id" :to="`/app/proposals/${proposal.id}`" class="surface-row block">
                <div class="flex gap-3 items-start justify-between">
                  <div>
                    <p class="text-sm font-semibold">
                      {{ proposal.title }}
                    </p>
                    <p class="muted text-sm mt-2">
                      Updated {{ formatDate(proposal.updatedAt) }}
                    </p>
                  </div>
                  <BaseBadge tone="accent">
                    {{ proposal.status }}
                  </BaseBadge>
                </div>
              </NuxtLink>

              <NuxtLink v-for="contract in relationship.activeContracts" :key="contract.id" :to="`/app/contracts/${contract.id}`" class="surface-row block">
                <div class="flex gap-3 items-start justify-between">
                  <div>
                    <p class="text-sm font-semibold">
                      {{ contract.title }}
                    </p>
                    <p class="muted text-sm mt-2">
                      Updated {{ formatDate(contract.updatedAt) }}
                    </p>
                  </div>
                  <BaseBadge :tone="contract.status === 'signed' ? 'success' : 'accent'">
                    {{ contract.status }}
                  </BaseBadge>
                </div>
              </NuxtLink>

              <EmptyState
                v-if="!relationship.activeProposals.length && !relationship.activeContracts.length"
                icon="i-carbon-document"
                title="No written terms yet"
                description="Use the conversation to confirm fit before sending a proposal."
              />
            </div>
          </article>

          <article class="panel p-6">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div>
                <h2 class="text-xl font-semibold">
                  Decision log
                </h2>
                <p class="muted text-sm leading-6 mt-2">
                  The terms and open questions that define who decides what before the relationship becomes harder to unwind.
                </p>
              </div>
              <BaseBadge tone="neutral">
                {{ relationship.decisionLog.length }} entries
              </BaseBadge>
            </div>

            <div class="surface-row-list mt-5">
              <NuxtLink
                v-for="entry in relationship.decisionLog"
                :key="entry.id"
                :to="entry.href || undefined"
                class="surface-row block"
              >
                <div class="flex flex-wrap gap-2 items-center">
                  <BaseBadge :tone="decisionTone(entry.status)">
                    {{ entry.status }}
                  </BaseBadge>
                  <p class="text-sm font-semibold">
                    {{ entry.title }}
                  </p>
                </div>
                <p class="muted text-sm leading-6 mt-2">
                  {{ entry.summary }}
                </p>
                <p class="text-xs text-[var(--muted)] mt-3">
                  {{ actorLabel(entry.ownerUserId) }} · {{ formatDate(entry.createdAt) }}
                </p>
              </NuxtLink>
            </div>
          </article>
        </section>

        <aside class="gap-5 grid content-start">
          <article class="panel p-6">
            <h2 class="text-lg font-semibold">
              Counterpart fit
            </h2>
            <p class="muted text-sm leading-6 mt-3">
              {{ relationship.counterpartProfile.headline }}
            </p>
            <div class="mt-5">
              <TrustSignalStrip :profile="relationship.counterpartProfile" />
            </div>
          </article>

          <article class="panel p-6">
            <div class="flex flex-wrap gap-2 items-center justify-between">
              <h2 class="text-lg font-semibold">
                Files and artifacts
              </h2>
              <BaseBadge tone="neutral">
                {{ relationship.files.length }}
              </BaseBadge>
            </div>
            <div class="surface-row-list mt-4">
              <NuxtLink
                v-for="file in relationship.files"
                :key="file.id"
                :to="file.href || undefined"
                class="surface-row block"
              >
                <p class="text-sm font-semibold">
                  {{ file.name }}
                </p>
                <p class="muted text-sm leading-6 mt-2">
                  {{ file.sourceLabel }} · {{ file.sizeLabel }}
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <BaseBadge :tone="scanTone(file.scanStatus)">
                    {{ file.scanStatus === "not_applicable" ? "shared" : file.scanStatus }}
                  </BaseBadge>
                  <BaseBadge tone="neutral">
                    {{ file.status }}
                  </BaseBadge>
                </div>
              </NuxtLink>

              <EmptyState
                v-if="!relationship.files.length"
                icon="i-carbon-document-attachment"
                title="No files yet"
                description="Shared files, upload records, and scan status will appear here."
              />
            </div>
          </article>

          <article class="panel p-6">
            <h2 class="text-lg font-semibold">
              Next action
            </h2>
            <div class="surface-row-list mt-4">
              <NuxtLink v-for="action in relationship.nextActions" :key="action.id" :to="action.href" class="surface-row block">
                <p class="text-sm font-semibold">
                  {{ action.label }}
                </p>
                <p class="muted text-sm leading-6 mt-2">
                  {{ action.summary }}
                </p>
              </NuxtLink>
            </div>
          </article>

          <details v-if="currentProfile" class="panel p-6">
            <summary class="text-lg font-semibold cursor-pointer">
              Alignment check
            </summary>
            <div class="mt-5">
              <AlignmentCheckPanel
                :current-profile="currentProfile"
                :counterpart-profile="relationship.counterpartProfile"
              />
            </div>
          </details>

          <TrialCollaborationCard
            v-if="relationship.trial"
            :trial="relationship.trial"
            :acknowledged="relationship.trial.acknowledgedByUserIds.includes(authStore.currentUser?.id || '')"
          />

          <article v-else class="panel p-6">
            <h2 class="text-lg font-semibold">
              Trial sprint
            </h2>
            <p class="muted text-sm leading-6 mt-3">
              No sprint has been attached yet. Start one from matches once both sides are ready to pressure-test the working relationship.
            </p>
            <BaseButton class="mt-4" variant="secondary" to="/app/matches">
              Open matches
            </BaseButton>
          </article>
        </aside>
      </div>
    </template>
  </div>
</template>
