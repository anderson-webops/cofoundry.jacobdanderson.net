<script setup lang="ts">
import type { FileUploadPurpose, FileUploadRelatedType } from "~/shared/types/domain"
import type { RelationshipDecisionStatus, RelationshipSnapshot, RelationshipTimelineKind } from "~/shared/utils/relationships"
import { formatDate, formatRelativeDate } from "~/shared/utils/format"
import { getProfileByUserId } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Relationship workspace")

const route = useRoute()
const toastStore = useToastStore()
const { authStore, workspaceStore } = useCurrentMember()
const matchId = computed(() => String(route.params.id || ""))
const requestHeaders = import.meta.server
  ? useRequestHeaders(["cookie"])
  : undefined
const timelineFilter = ref<RelationshipTimelineKind | "all">("all")
const fileInput = ref<HTMLInputElement | null>(null)
const uploadPending = ref(false)
const uploadError = ref("")
const uploadNotice = ref("")
const relationshipRefreshPending = ref(false)
const lastRelationshipRefreshAt = ref("")
const decisionLogBody = ref("")
const decisionLogTitle = ref("")
const decisionLogStatus = ref<"open" | "documented">("open")
const decisionLogPending = ref(false)
const decisionLogError = ref("")
let relationshipRefreshTimer: number | null = null

const { data, error, pending, refresh } = await useAsyncData(
  `relationship:${matchId.value}`,
  () => $fetch<{ relationship: RelationshipSnapshot }>(`/api/relationships/${matchId.value}`, { headers: requestHeaders }),
)

const maxUploadBytes = 10 * 1024 * 1024
const allowedUploadMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])
const relationship = computed(() => data.value?.relationship || null)
const latestMessages = computed(() => [
  ...(relationship.value?.latestMessages || [])
].reverse())
const currentProfile = computed(() => authStore.currentUser
  ? getProfileByUserId(workspaceStore.data, authStore.currentUser.id)
  : null)
const relationshipUploadTarget = computed<{ label: string, purpose: FileUploadPurpose, relatedId: string, relatedType: FileUploadRelatedType } | null>(() => {
  if (!relationship.value)
    return null

  const contract = relationship.value.activeContracts[0]
  if (contract) {
    return {
      label: contract.title,
      purpose: "contract_attachment",
      relatedId: contract.id,
      relatedType: "contract",
    }
  }

  const proposal = relationship.value.activeProposals[0]
  if (proposal) {
    return {
      label: proposal.title,
      purpose: "proposal_attachment",
      relatedId: proposal.id,
      relatedType: "proposal",
    }
  }

  const latestMessage = relationship.value.latestMessages[0]
  if (latestMessage) {
    return {
      label: "the latest conversation",
      purpose: "message_attachment",
      relatedId: latestMessage.id,
      relatedType: "message",
    }
  }

  return null
})
const timelineFilters = [
  { id: "all", label: "All" },
  { id: "message", label: "Messages" },
  { id: "proposal", label: "Proposals" },
  { id: "comment", label: "Comments" },
  { id: "contract", label: "Agreements" },
  { id: "signature", label: "Signatures" },
  { id: "trial", label: "Trial" },
  { id: "file", label: "Files" },
  { id: "decision", label: "Decisions" },
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
    decision: "warning",
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

async function refreshRelationship() {
  if (relationshipRefreshPending.value)
    return

  relationshipRefreshPending.value = true

  try {
    await refresh()
    lastRelationshipRefreshAt.value = new Date().toISOString()
  }
  finally {
    relationshipRefreshPending.value = false
  }
}

function shouldAutoRefreshRelationship() {
  return Boolean(relationship.value)
    && !relationshipRefreshPending.value
    && !decisionLogPending.value
    && !uploadPending.value
    && document.visibilityState === "visible"
}

function handleRelationshipVisibilityChange() {
  if (shouldAutoRefreshRelationship())
    void refreshRelationship()
}

onMounted(() => {
  lastRelationshipRefreshAt.value = new Date().toISOString()
  relationshipRefreshTimer = window.setInterval(() => {
    if (shouldAutoRefreshRelationship())
      void refreshRelationship()
  }, 30 * 1000)
  document.addEventListener("visibilitychange", handleRelationshipVisibilityChange)
})

onBeforeUnmount(() => {
  if (relationshipRefreshTimer)
    window.clearInterval(relationshipRefreshTimer)

  document.removeEventListener("visibilitychange", handleRelationshipVisibilityChange)
})

function inferMimeType(file: File) {
  if (file.type)
    return file.type

  const filename = file.name.toLowerCase()
  if (filename.endsWith(".pdf"))
    return "application/pdf"
  if (filename.endsWith(".png"))
    return "image/png"
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg"))
    return "image/jpeg"
  if (filename.endsWith(".txt") || filename.endsWith(".md"))
    return "text/plain"
  if (filename.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

  return "application/octet-stream"
}

function openRelationshipFilePicker() {
  uploadError.value = ""
  uploadNotice.value = ""
  fileInput.value?.click()
}

async function uploadRelationshipFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""

  if (!file)
    return

  const target = relationshipUploadTarget.value
  if (!target) {
    uploadError.value = "There is not a relationship artifact to attach this file to yet."
    return
  }

  const mimeType = inferMimeType(file)
  if (!allowedUploadMimeTypes.has(mimeType)) {
    uploadError.value = "Upload a PDF, DOCX, TXT, PNG, or JPEG file."
    return
  }

  if (file.size > maxUploadBytes) {
    uploadError.value = "Files must be 10MB or smaller."
    return
  }

  uploadPending.value = true
  uploadError.value = ""
  uploadNotice.value = ""

  try {
    const { policy } = await $fetch<{
      policy: {
        id: string
        method: "PUT"
        signedUploadUrl: string | null
        uploadToken: string | null
      }
    }>("/api/files/upload-policy", {
      method: "POST",
      body: {
        filename: file.name,
        mimeType,
        purpose: target.purpose,
        relatedId: target.relatedId,
        relatedType: target.relatedType,
        sizeBytes: file.size,
      },
    })

    if (!policy.signedUploadUrl)
      throw new Error("Upload URL was not created.")

    const response = await fetch(policy.signedUploadUrl, {
      body: file,
      headers: {
        "content-type": mimeType,
        ...(policy.uploadToken
          ? { "x-cofoundry-upload-token": policy.uploadToken }
          : {}),
      },
      method: policy.method,
    })

    if (!response.ok)
      throw new Error("The upload could not be completed.")

    await refresh()
    lastRelationshipRefreshAt.value = new Date().toISOString()
    uploadNotice.value = `Uploaded ${file.name}. It will remain marked pending until the file scanner records a result.`
  }
  catch (error) {
    uploadError.value = error instanceof Error
      ? error.message
      : "The file could not be uploaded."
  }
  finally {
    uploadPending.value = false
  }
}

async function addDecisionLogEntry() {
  if (!relationship.value || !authStore.currentUser)
    return

  const title = decisionLogTitle.value.trim()
  const body = decisionLogBody.value.trim()
  if (title.length < 4 || body.length < 12) {
    decisionLogError.value = "Add enough detail for the decision log to be useful later."
    return
  }

  decisionLogPending.value = true
  decisionLogError.value = ""

  try {
    await workspaceStore.addRelationshipDecision(relationship.value.match.id, authStore.currentUser.id, title, body, decisionLogStatus.value)
    decisionLogTitle.value = ""
    decisionLogBody.value = ""
    await refreshRelationship()
    toastStore.push({
      title: "Decision note added",
      message: "The note is now part of the relationship log and visible to both participants.",
      tone: "success",
    })
  }
  catch (error) {
    decisionLogError.value = error instanceof Error
      ? error.message
      : "The decision note could not be saved."
  }
  finally {
    decisionLogPending.value = false
  }
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Relationship"
      :title="relationship ? relationship.counterpartProfile.displayName : 'Relationship workspace'"
    >
      <template #actions>
        <BaseBadge v-if="lastRelationshipRefreshAt" tone="neutral">
          Updated {{ formatRelativeDate(lastRelationshipRefreshAt) }}
        </BaseBadge>
        <BaseButton variant="secondary" :disabled="pending || relationshipRefreshPending" @click="refreshRelationship">
          {{ pending || relationshipRefreshPending ? "Refreshing..." : "Refresh" }}
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

            <div class="surface-divider mt-5">
              <div class="flex flex-wrap gap-3 items-start justify-between">
                <div>
                  <h3 class="text-base font-semibold">
                    Add a decision note
                  </h3>
                </div>
                <BaseBadge tone="accent">
                  Relationship-level
                </BaseBadge>
              </div>
              <div class="mt-4 gap-3 grid">
                <TextInput
                  v-model="decisionLogTitle"
                  label="Decision title"
                  placeholder="Example: Architecture decisions during the trial"
                  :error="decisionLogError && decisionLogTitle.trim().length < 4 ? decisionLogError : ''"
                />
                <div>
                  <span class="field-label">
                    <span>Status</span>
                  </span>
                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      class="pill"
                      :class="decisionLogStatus === 'open' ? 'pill-active' : ''"
                      @click="decisionLogStatus = 'open'"
                    >
                      Open question
                    </button>
                    <button
                      type="button"
                      class="pill"
                      :class="decisionLogStatus === 'documented' ? 'pill-active' : ''"
                      @click="decisionLogStatus = 'documented'"
                    >
                      Documented
                    </button>
                  </div>
                </div>
                <TextareaInput
                  v-model="decisionLogBody"
                  label="Decision note"
                  placeholder="Example: Malik owns architecture decisions unless the choice changes financing, compliance, or company strategy."
                  :error="decisionLogError"
                  :rows="3"
                />
                <div class="flex justify-end">
                  <BaseButton
                    :disabled="decisionLogPending || decisionLogTitle.trim().length < 4 || decisionLogBody.trim().length < 12"
                    @click="addDecisionLogEntry"
                  >
                    {{ decisionLogPending ? "Saving..." : "Add to log" }}
                  </BaseButton>
                </div>
              </div>
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
              <div>
                <h2 class="text-lg font-semibold">
                  Files and artifacts
                </h2>
                <p v-if="relationshipUploadTarget" class="muted text-sm leading-6 mt-2">
                  Attach PDFs, docs, images, or notes to {{ relationshipUploadTarget.label }}.
                </p>
              </div>
              <div class="flex flex-wrap gap-2 items-center">
                <BaseBadge tone="neutral">
                  {{ relationship.files.length }}
                </BaseBadge>
                <BaseButton
                  size="sm"
                  variant="secondary"
                  :disabled="uploadPending || !relationshipUploadTarget"
                  @click="openRelationshipFilePicker"
                >
                  {{ uploadPending ? "Uploading..." : "Upload file" }}
                </BaseButton>
              </div>
            </div>
            <input
              ref="fileInput"
              accept=".docx,.jpeg,.jpg,.pdf,.png,.txt,application/pdf,image/jpeg,image/png,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              class="hidden"
              type="file"
              @change="uploadRelationshipFile"
            >
            <p v-if="uploadError" class="text-sm text-[var(--danger)] leading-6 mt-4">
              {{ uploadError }}
            </p>
            <p v-else-if="uploadNotice" class="text-sm text-[var(--success)] leading-6 mt-4">
              {{ uploadNotice }}
            </p>
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
