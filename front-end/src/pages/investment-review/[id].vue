<script setup lang="ts">
import type {
  InvestmentDataRoomCategory,
  InvestmentDecisionOutcome,
  InvestmentPartnerHandoffStatus,
  InvestmentPartnerType,
  InvestmentProgramApplicationStatus,
  InvestmentReviewerMutation,
  InvestmentReviewNoteCategory,
  InvestmentReviewPriority,
} from "~/shared/types/investment-workspaces"

definePageMeta({
  layout: "investment-review",
  middleware: ["investment-review"],
})

usePageSeo("Investment review case")

type TabId = "overview" | "application" | "data-room" | "diligence" | "updates" | "decisions" | "handoffs" | "audit"

const route = useRoute()
const router = useRouter()
const reviewStore = useInvestmentReviewStore()
const toastStore = useToastStore()
const workspaceId = computed(() => String(route.params.id || ""))
const pending = ref(false)
const dialog = ref<"review" | "information" | "diligence" | "note" | "decision" | "handoff" | "">("")

await reviewStore.loadCase(workspaceId.value)

const workspace = computed(() => reviewStore.snapshot.workspaces.find(item => item.id === workspaceId.value) || null)
const tabs: Array<{ id: TabId, icon: string, label: string }> = [
  { id: "overview", icon: "i-carbon-dashboard", label: "Overview" },
  { id: "application", icon: "i-carbon-document", label: "Application" },
  { id: "data-room", icon: "i-carbon-folder", label: "Data room" },
  { id: "diligence", icon: "i-carbon-task", label: "Diligence" },
  { id: "updates", icon: "i-carbon-chart-line", label: "Updates" },
  { id: "decisions", icon: "i-carbon-checkmark-outline", label: "Decisions" },
  { id: "handoffs", icon: "i-carbon-connect", label: "Handoffs" },
  { id: "audit", icon: "i-carbon-document-tasks", label: "Audit" },
]
const activeTab = computed<TabId>(() => tabs.some(tab => tab.id === route.query.view) ? route.query.view as TabId : "overview")

const reviewForm = reactive({ priority: "standard" as InvestmentReviewPriority, riskFlags: "", stageSummary: "" })
const informationForm = reactive({ dueAt: "", request: "", title: "" })
const diligenceForm = reactive({ category: "financial" as InvestmentDataRoomCategory, description: "", dueAt: "", title: "" })
const noteForm = reactive({ body: "", category: "screening" as InvestmentReviewNoteCategory })
const decisionForm = reactive({ internalRationale: "", outcome: "hold" as InvestmentDecisionOutcome, publicRationale: "" })
const handoffForm = reactive({
  internalNotes: "",
  partnerName: "",
  partnerType: "broker_dealer" as InvestmentPartnerType,
  partnerUrl: "",
  sharedDataRoomItemIds: [] as string[],
})

const allowedStatuses = computed<InvestmentProgramApplicationStatus[]>(() => {
  const status = workspace.value?.application.status
  const map: Partial<Record<InvestmentProgramApplicationStatus, InvestmentProgramApplicationStatus[]>> = {
    accepted: ["closed"],
    committee_review: ["diligence", "information_requested"],
    declined: ["closed"],
    diligence: ["information_requested", "committee_review"],
    information_requested: ["under_review", "diligence", "committee_review"],
    submitted: ["under_review", "information_requested", "diligence"],
    under_review: ["information_requested", "diligence", "committee_review"],
  }
  return status ? map[status] || [] : []
})

function allowedHandoffStatuses(status: InvestmentPartnerHandoffStatus) {
  const map: Record<InvestmentPartnerHandoffStatus, InvestmentPartnerHandoffStatus[]> = {
    acknowledged: ["closed"],
    canceled: [],
    closed: [],
    consent_pending: ["ready", "canceled"],
    planned: ["consent_pending", "ready", "canceled"],
    ready: ["sent", "canceled"],
    sent: ["acknowledged", "closed"],
  }
  return map[status]
}

const openRequests = computed(() => workspace.value?.informationRequests.filter(item => ["open", "answered"].includes(item.status)) || [])
const openDiligence = computed(() => workspace.value?.diligenceItems.filter(item => ["open", "in_progress", "submitted"].includes(item.status)) || [])
const cleanSharedItems = computed(() => workspace.value?.dataRoomItems || [])

function statusLabel(status: string) {
  return status.replaceAll("_", " ")
}

function statusTone(status: string) {
  if (["accepted", "acknowledged", "closed"].includes(status))
    return "success" as const
  if (["declined", "information_requested", "urgent", "canceled"].includes(status))
    return "warning" as const
  if (["under_review", "diligence", "committee_review", "ready", "sent"].includes(status))
    return "accent" as const
  return "neutral" as const
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value)) : "Not set"
}

function fileUpload(uploadId: string | null) {
  return uploadId ? reviewStore.snapshot.fileUploads.find(item => item.id === uploadId) || null : null
}

function fileIsDownloadable(uploadId: string | null) {
  const upload = fileUpload(uploadId)
  return upload?.status === "uploaded" && upload.scanStatus === "clean"
}

function toIsoDate(value: string) {
  return value ? new Date(`${value}T17:00:00`).toISOString() : null
}

function reviewerName(userId: string | null) {
  return reviewStore.snapshot.reviewers.find(item => item.id === userId)?.name || "Unassigned"
}

function errorMessage(error: unknown) {
  const payload = error as { data?: { message?: string }, statusMessage?: string }
  return payload.data?.message || payload.statusMessage || "The review change could not be saved."
}

async function selectTab(tab: TabId) {
  await router.replace({ query: { ...route.query, view: tab === "overview" ? undefined : tab } })
}

async function mutate(mutation: InvestmentReviewerMutation, message: string) {
  if (!workspace.value)
    return null
  pending.value = true
  try {
    const result = await reviewStore.mutate(workspace.value, mutation)
    toastStore.push({ message, title: "Review updated", tone: "success" })
    return result
  }
  catch (error) {
    await reviewStore.loadCase(workspaceId.value, true).catch(() => undefined)
    toastStore.push({ message: errorMessage(error), title: "Change not saved", tone: "danger" })
    return null
  }
  finally {
    pending.value = false
  }
}

async function assignReviewer(event: Event) {
  const reviewerUserId = (event.target as HTMLSelectElement).value || null
  await mutate({ action: "assign_reviewer", reviewerUserId }, reviewerUserId ? "Case assignment updated." : "Case returned to the shared queue.")
}

async function updateStatus(event: Event) {
  const status = (event.target as HTMLSelectElement).value as InvestmentProgramApplicationStatus
  if (status)
    await mutate({ action: "set_application_status", status: status as Exclude<InvestmentProgramApplicationStatus, "accepted" | "declined" | "draft" | "withdrawn"> }, `Application moved to ${statusLabel(status)}.`)
  ;(event.target as HTMLSelectElement).value = ""
}

async function saveReview() {
  if (!await mutate({
    action: "update_review",
    priority: reviewForm.priority,
    riskFlags: reviewForm.riskFlags.split("\n").map(item => item.trim()).filter(Boolean),
    stageSummary: reviewForm.stageSummary,
  }, "Internal review summary saved.")) {
    return
  }
  dialog.value = ""
}

async function requestInformation() {
  if (!await mutate({ action: "request_information", dueAt: toIsoDate(informationForm.dueAt), request: informationForm.request, title: informationForm.title }, "Information request sent to the applicant."))
    return
  Object.assign(informationForm, { dueAt: "", request: "", title: "" })
  dialog.value = ""
}

async function createDiligence() {
  if (!await mutate({ action: "create_diligence_item", category: diligenceForm.category, description: diligenceForm.description, dueAt: toIsoDate(diligenceForm.dueAt), title: diligenceForm.title }, "Diligence item opened."))
    return
  Object.assign(diligenceForm, { category: "financial", description: "", dueAt: "", title: "" })
  dialog.value = ""
}

async function addNote() {
  if (!await mutate({ action: "add_review_note", body: noteForm.body, category: noteForm.category }, "Internal review note added."))
    return
  Object.assign(noteForm, { body: "", category: "screening" })
  dialog.value = ""
}

async function recordDecision() {
  if (!await mutate({ action: "record_decision", ...decisionForm }, "Decision recorded."))
    return
  Object.assign(decisionForm, { internalRationale: "", outcome: "hold", publicRationale: "" })
  dialog.value = ""
}

async function createHandoff() {
  if (!await mutate({ action: "create_partner_handoff", ...handoffForm }, "Regulated-partner handoff prepared."))
    return
  Object.assign(handoffForm, { internalNotes: "", partnerName: "", partnerType: "broker_dealer", partnerUrl: "", sharedDataRoomItemIds: [] })
  dialog.value = ""
}

async function updateHandoffStatus(handoffId: string, event: Event) {
  if (!workspace.value)
    return
  const handoff = workspace.value.partnerHandoffs.find(item => item.id === handoffId)
  if (!handoff)
    return
  const select = event.target as HTMLSelectElement
  const status = select.value as InvestmentPartnerHandoffStatus
  if (!status)
    return
  await mutate({
    action: "update_partner_handoff",
    externalReference: handoff.externalReference,
    handoffId,
    internalNotes: handoff.internalNotes,
    sharedDataRoomItemIds: handoff.sharedDataRoomItemIds,
    status,
  }, `${handoff.partnerName} handoff updated.`)
  select.value = ""
}

function openReviewDialog() {
  if (!workspace.value)
    return
  reviewForm.priority = workspace.value.review.priority
  reviewForm.riskFlags = workspace.value.review.riskFlags.join("\n")
  reviewForm.stageSummary = workspace.value.review.stageSummary
  dialog.value = "review"
}
</script>

<template>
  <div v-if="workspace" class="gap-6 grid">
    <PageIntro
      eyebrow="Investment review case"
      :title="workspace.companyName"
      :description="workspace.application.companySummary"
    >
      <template #actions>
        <BaseBadge :tone="statusTone(workspace.application.status)">
          {{ statusLabel(workspace.application.status) }}
        </BaseBadge>
        <BaseButton variant="secondary" to="/investment-review">
          <span class="i-carbon-arrow-left" />
          Queue
        </BaseButton>
      </template>
    </PageIntro>

    <div class="overflow-x-auto">
      <div class="p-1 border border-[var(--line)] rounded-xl bg-[var(--panel-inset)] inline-flex gap-1 min-w-max" role="tablist" aria-label="Investment review views">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          class="text-sm font-semibold px-3 py-2 rounded-lg inline-flex gap-2 transition items-center"
          :class="activeTab === tab.id ? 'bg-[var(--panel-strong)] text-[var(--text)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--text)]'"
          @click="selectTab(tab.id)"
        >
          <span :class="tab.icon" />
          {{ tab.label }}
        </button>
      </div>
    </div>

    <template v-if="activeTab === 'overview'">
      <div class="gap-4 grid sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Requested" :value="workspace.application.requestedAmount" :context="statusLabel(workspace.application.instrument)" />
        <MetricTile label="Shared files" :value="workspace.dataRoomItems.length" context="Applicant-approved program access" />
        <MetricTile label="Open requests" :value="openRequests.length + openDiligence.length" context="Information and diligence" />
        <MetricTile label="Revision" :value="workspace.application.submissionRevision" :context="`Submitted ${formatDate(workspace.application.submittedAt)}`" />
      </div>

      <div class="gap-6 grid xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section class="panel p-5 md:p-6">
          <div class="flex flex-wrap gap-3 items-center justify-between">
            <h2 class="text-lg font-semibold">
              Case control
            </h2>
            <BaseButton size="sm" variant="secondary" @click="openReviewDialog">
              <span class="i-carbon-edit" />
              Review summary
            </BaseButton>
          </div>
          <div class="mt-5 gap-4 grid md:grid-cols-2">
            <SelectInput
              :model-value="workspace.review.assignedReviewerUserId || ''"
              label="Assigned reviewer"
              :options="[{ label: 'Unassigned', value: '' }, ...reviewStore.snapshot.reviewers.map(item => ({ label: item.name, value: item.id }))]"
              @change="assignReviewer"
            />
            <SelectInput
              model-value=""
              label="Move application"
              :disabled="!allowedStatuses.length"
              :options="[{ label: allowedStatuses.length ? 'Choose status' : 'No transition available', value: '' }, ...allowedStatuses.map(status => ({ label: statusLabel(status), value: status }))]"
              @change="updateStatus"
            />
          </div>
          <dl class="surface-row-list mt-5">
            <div class="surface-row">
              <dt class="muted text-sm">
                Assigned reviewer
              </dt>
              <dd class="font-semibold mt-1">
                {{ reviewerName(workspace.review.assignedReviewerUserId) }}
              </dd>
            </div>
            <div class="surface-row">
              <dt class="muted text-sm">
                Stage summary
              </dt>
              <dd class="text-sm leading-6 mt-1">
                {{ workspace.review.stageSummary || 'No internal stage summary recorded.' }}
              </dd>
            </div>
            <div class="surface-row">
              <dt class="muted text-sm">
                Risk flags
              </dt>
              <dd v-if="workspace.review.riskFlags.length" class="mt-2 flex flex-wrap gap-2">
                <BaseBadge v-for="flag in workspace.review.riskFlags" :key="flag" tone="warning">
                  {{ flag }}
                </BaseBadge>
              </dd>
              <dd v-else class="muted text-sm mt-1">
                No internal risk flags.
              </dd>
            </div>
          </dl>
        </section>

        <section class="panel p-5 md:p-6">
          <h2 class="text-lg font-semibold">
            Submitted readiness
          </h2>
          <div class="mt-5 gap-3 grid">
            <div
              v-for="item in [
                { label: 'Formation complete', value: workspace.readiness.formationComplete },
                { label: 'Cap table current', value: workspace.readiness.capTableCurrent },
                { label: 'Financials current', value: workspace.readiness.financialsCurrent },
                { label: 'Data room ready', value: workspace.readiness.dataRoomReady },
                { label: 'Counsel engaged', value: workspace.readiness.counselEngaged },
              ]" :key="item.label" class="flex gap-3 items-center justify-between"
            >
              <span class="text-sm">{{ item.label }}</span>
              <span :class="item.value ? 'i-carbon-checkmark-filled text-[var(--success)]' : 'i-carbon-warning-alt text-[var(--warning)]'" />
            </div>
          </div>
          <div class="panel-inset text-sm leading-6 mt-5 p-4">
            {{ workspace.readiness.notes || 'No applicant readiness note.' }}
          </div>
        </section>
      </div>

      <section class="panel p-5 md:p-6">
        <div class="flex flex-wrap gap-3 items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold">
              Review actions
            </h2>
            <p class="muted text-sm mt-1">
              Requests, internal analysis, committee records, and partner preparation.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <BaseButton size="sm" variant="secondary" @click="dialog = 'information'">
              <span class="i-carbon-request-quote" />Request information
            </BaseButton>
            <BaseButton size="sm" variant="secondary" @click="dialog = 'diligence'">
              <span class="i-carbon-task-add" />Open diligence
            </BaseButton>
            <BaseButton size="sm" variant="secondary" @click="dialog = 'note'">
              <span class="i-carbon-notebook" />Internal note
            </BaseButton>
            <BaseButton size="sm" @click="dialog = 'decision'">
              <span class="i-carbon-checkmark-outline" />Record decision
            </BaseButton>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="activeTab === 'application'">
      <section class="panel p-5 md:p-6">
        <div class="flex flex-wrap gap-3 items-center justify-between">
          <h2 class="text-lg font-semibold">
            Submitted application
          </h2>
          <a :href="workspace.application.deckUrl" target="_blank" rel="noopener noreferrer" class="text-sm text-[var(--accent)] font-semibold inline-flex gap-2 items-center">
            <span class="i-carbon-launch" /> Open submitted deck
          </a>
        </div>
        <dl class="mt-5 gap-5 grid md:grid-cols-2">
          <div>
            <dt class="muted text-sm">
              Company
            </dt><dd class="text-sm leading-6 mt-2">
              {{ workspace.application.companySummary }}
            </dd>
          </div>
          <div>
            <dt class="muted text-sm">
              Traction
            </dt><dd class="text-sm leading-6 mt-2">
              {{ workspace.application.traction }}
            </dd>
          </div>
          <div>
            <dt class="muted text-sm">
              Team
            </dt><dd class="text-sm leading-6 mt-2">
              {{ workspace.application.teamSummary }}
            </dd>
          </div>
          <div>
            <dt class="muted text-sm">
              Use of funds
            </dt><dd class="text-sm leading-6 mt-2">
              {{ workspace.application.useOfFunds }}
            </dd>
          </div>
          <div>
            <dt class="muted text-sm">
              Fundraising history
            </dt><dd class="text-sm leading-6 mt-2">
              {{ workspace.application.fundraisingHistory }}
            </dd>
          </div>
          <div>
            <dt class="muted text-sm">
              Program reason
            </dt><dd class="text-sm leading-6 mt-2">
              {{ workspace.application.reason }}
            </dd>
          </div>
        </dl>
        <div class="panel-inset mt-6 p-4 gap-3 grid sm:grid-cols-2">
          <p class="text-sm">
            Terms version: <strong>{{ workspace.application.supplementalTermsVersion }}</strong>
          </p>
          <p class="text-sm">
            Accepted: <strong>{{ formatDate(workspace.application.supplementalTermsAcceptedAt) }}</strong>
          </p>
          <p class="text-sm">
            No funding guarantee: <strong>{{ workspace.application.attestations.noFundingGuarantee ? 'Acknowledged' : 'Missing' }}</strong>
          </p>
          <p class="text-sm">
            Regulated execution: <strong>{{ workspace.application.attestations.regulatedExecutionAcknowledged ? 'Acknowledged' : 'Missing' }}</strong>
          </p>
        </div>
      </section>
    </template>

    <template v-else-if="activeTab === 'data-room'">
      <div class="panel-inset text-sm leading-6 p-4 flex gap-3 items-start">
        <span class="i-carbon-locked text-[var(--accent)] mt-1" />
        <p class="muted">
          Only records the applicant explicitly shared with the program appear here. Applicant outreach contacts and private data-room records are not included in staff responses.
        </p>
      </div>
      <div v-if="workspace.dataRoomItems.length" class="gap-4 grid md:grid-cols-2">
        <article v-for="item in workspace.dataRoomItems" :key="item.id" class="panel p-5">
          <div class="flex gap-3 items-start justify-between">
            <div>
              <BaseBadge tone="neutral">
                {{ statusLabel(item.category) }}
              </BaseBadge><h2 class="font-semibold mt-3">
                {{ item.title }}
              </h2>
            </div>
            <span class="i-carbon-unlocked text-[var(--success)]" title="Shared with program" />
          </div>
          <p class="muted text-sm leading-6 mt-3">
            {{ item.description }}
          </p>
          <div class="mt-4 flex flex-wrap gap-2">
            <BaseButton v-if="fileIsDownloadable(item.fileUploadId)" size="sm" variant="secondary" :href="`/api/files/${item.fileUploadId}/download`">
              <span class="i-carbon-download" />Download
            </BaseButton>
            <BaseBadge v-else-if="item.fileUploadId" :tone="statusTone(fileUpload(item.fileUploadId)?.scanStatus || 'pending')">
              {{ statusLabel(fileUpload(item.fileUploadId)?.scanStatus || 'pending scan') }}
            </BaseBadge>
            <BaseButton v-if="item.externalUrl" size="sm" variant="secondary" :href="item.externalUrl">
              <span class="i-carbon-launch" />Open secure link
            </BaseButton>
          </div>
        </article>
      </div>
      <EmptyState v-else icon="i-carbon-folder" title="No shared records" description="The applicant has not shared a data-room record with the program." />
    </template>

    <template v-else-if="activeTab === 'diligence'">
      <div class="flex justify-end">
        <BaseButton @click="dialog = 'diligence'">
          <span class="i-carbon-add" />Open diligence item
        </BaseButton>
      </div>
      <div v-if="workspace.diligenceItems.length" class="gap-4 grid">
        <article v-for="item in workspace.diligenceItems" :key="item.id" class="panel p-5 md:p-6">
          <div class="flex flex-wrap gap-3 items-start justify-between">
            <div>
              <div class="flex gap-2">
                <BaseBadge :tone="statusTone(item.status)">
                  {{ statusLabel(item.status) }}
                </BaseBadge><BaseBadge tone="neutral">
                  {{ statusLabel(item.category) }}
                </BaseBadge>
              </div><h2 class="font-semibold mt-3">
                {{ item.title }}
              </h2>
            </div>
            <div v-if="['open', 'in_progress', 'submitted'].includes(item.status)" class="flex gap-2">
              <BaseButton size="sm" variant="secondary" @click="mutate({ action: 'resolve_diligence_item', diligenceItemId: item.id, status: 'accepted' }, `${item.title} accepted.`)">
                Accept
              </BaseButton>
              <BaseButton size="sm" variant="ghost" @click="mutate({ action: 'resolve_diligence_item', diligenceItemId: item.id, status: 'waived' }, `${item.title} waived.`)">
                Waive
              </BaseButton>
            </div>
          </div>
          <p class="muted text-sm leading-6 mt-3">
            {{ item.description }}
          </p>
          <div v-if="item.response" class="panel-inset text-sm leading-6 mt-4 p-4">
            <p class="font-semibold">
              Applicant response
            </p><p class="muted mt-2">
              {{ item.response }}
            </p>
          </div>
          <p class="muted text-xs mt-4">
            Due {{ formatDate(item.dueAt) }} · {{ item.evidenceDataRoomItemIds.length }} evidence item(s)
          </p>
        </article>
      </div>
      <EmptyState v-else icon="i-carbon-task" title="No diligence items" description="Open a focused diligence request when the application is ready for deeper review." />

      <section class="panel p-5 md:p-6">
        <div class="flex flex-wrap gap-3 items-center justify-between">
          <h2 class="text-lg font-semibold">
            Information requests
          </h2><BaseButton size="sm" variant="secondary" @click="dialog = 'information'">
            <span class="i-carbon-add" />New request
          </BaseButton>
        </div>
        <div v-if="workspace.informationRequests.length" class="surface-row-list mt-4">
          <article v-for="item in workspace.informationRequests" :key="item.id" class="surface-row">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div>
                <BaseBadge :tone="statusTone(item.status)">
                  {{ statusLabel(item.status) }}
                </BaseBadge><h3 class="font-semibold mt-3">
                  {{ item.title }}
                </h3>
              </div><div v-if="['open', 'answered'].includes(item.status)" class="flex gap-2">
                <BaseButton size="sm" variant="secondary" @click="mutate({ action: 'close_information_request', informationRequestId: item.id, status: 'accepted' }, `${item.title} accepted.`)">
                  Accept
                </BaseButton><BaseButton size="sm" variant="ghost" @click="mutate({ action: 'close_information_request', informationRequestId: item.id, status: 'closed' }, `${item.title} closed.`)">
                  Close
                </BaseButton>
              </div>
            </div>
            <p class="muted text-sm leading-6 mt-3">
              {{ item.request }}
            </p>
            <div v-if="item.response" class="panel-inset text-sm leading-6 mt-4 p-4">
              <p class="font-semibold">
                Applicant response
              </p><p class="muted mt-2">
                {{ item.response }}
              </p>
            </div>
          </article>
        </div>
        <p v-else class="muted text-sm mt-4">
          No information requests.
        </p>
      </section>
    </template>

    <template v-else-if="activeTab === 'updates'">
      <div v-if="workspace.founderUpdates.length" class="gap-4 grid">
        <article v-for="update in workspace.founderUpdates" :key="update.id" class="panel p-5 md:p-6">
          <div class="flex gap-3 items-start justify-between">
            <div>
              <p class="section-kicker">
                {{ formatDate(update.createdAt) }}
              </p><h2 class="text-lg font-semibold mt-2">
                {{ update.title }}
              </h2>
            </div><BaseBadge tone="success">
              Shared
            </BaseBadge>
          </div>
          <p class="text-sm leading-6 mt-4">
            {{ update.body }}
          </p>
          <div v-if="update.metrics" class="panel-inset text-sm mt-4 p-4">
            {{ update.metrics }}
          </div>
        </article>
      </div>
      <EmptyState v-else icon="i-carbon-chart-line" title="No shared updates" description="The applicant has not published a program-visible founder update." />
    </template>

    <template v-else-if="activeTab === 'decisions'">
      <div class="flex flex-wrap gap-3 justify-end">
        <BaseButton variant="secondary" @click="dialog = 'note'">
          <span class="i-carbon-notebook" />Internal note
        </BaseButton><BaseButton @click="dialog = 'decision'">
          <span class="i-carbon-checkmark-outline" />Record decision
        </BaseButton>
      </div>
      <section class="panel p-5 md:p-6">
        <h2 class="text-lg font-semibold">
          Decision record
        </h2>
        <div v-if="workspace.decisions.length" class="surface-row-list mt-4">
          <article v-for="decision in workspace.decisions" :key="decision.id" class="surface-row">
            <div class="flex flex-wrap gap-2 items-center">
              <BaseBadge :tone="statusTone(decision.outcome)">
                {{ statusLabel(decision.outcome) }}
              </BaseBadge><span class="muted text-xs">{{ formatDate(decision.decidedAt) }}</span>
            </div>
            <p class="font-semibold mt-3">
              Applicant rationale
            </p><p class="text-sm leading-6 mt-2">
              {{ decision.publicRationale }}
            </p>
            <p class="font-semibold mt-4">
              Internal rationale
            </p><p class="muted text-sm leading-6 mt-2">
              {{ decision.internalRationale }}
            </p>
          </article>
        </div>
        <p v-else class="muted text-sm mt-4">
          No decision recorded.
        </p>
      </section>
      <section class="panel p-5 md:p-6">
        <h2 class="text-lg font-semibold">
          Internal notes
        </h2>
        <div v-if="workspace.reviewNotes.length" class="surface-row-list mt-4">
          <article v-for="note in workspace.reviewNotes" :key="note.id" class="surface-row">
            <div class="flex gap-2">
              <BaseBadge tone="neutral">
                {{ statusLabel(note.category) }}
              </BaseBadge><span class="muted text-xs">{{ formatDate(note.createdAt) }}</span>
            </div><p class="text-sm leading-6 mt-3">
              {{ note.body }}
            </p>
          </article>
        </div>
        <p v-else class="muted text-sm mt-4">
          No internal notes.
        </p>
      </section>
    </template>

    <template v-else-if="activeTab === 'handoffs'">
      <div class="flex flex-wrap gap-3 items-center justify-between">
        <div class="panel-inset text-sm leading-6 p-4 flex-1">
          Partner sharing consent: <strong>{{ workspace.application.attestations.regulatedPartnerSharingConsent ? 'Recorded' : 'Not recorded' }}</strong>
        </div>
        <BaseButton :disabled="!workspace.application.attestations.regulatedPartnerSharingConsent || !['accepted', 'committee_review'].includes(workspace.application.status)" @click="dialog = 'handoff'">
          <span class="i-carbon-connect" />Prepare handoff
        </BaseButton>
      </div>
      <div v-if="workspace.partnerHandoffs.length" class="gap-4 grid">
        <article v-for="handoff in workspace.partnerHandoffs" :key="handoff.id" class="panel p-5 md:p-6">
          <div class="flex flex-wrap gap-3 items-start justify-between">
            <div>
              <div class="flex gap-2">
                <BaseBadge :tone="statusTone(handoff.status)">
                  {{ statusLabel(handoff.status) }}
                </BaseBadge><BaseBadge tone="neutral">
                  {{ statusLabel(handoff.partnerType) }}
                </BaseBadge>
              </div><h2 class="font-semibold mt-3">
                {{ handoff.partnerName }}
              </h2><a :href="handoff.partnerUrl" target="_blank" rel="noopener noreferrer" class="text-sm text-[var(--accent)] mt-2 inline-flex gap-2 items-center"><span class="i-carbon-launch" />Partner site</a>
            </div><SelectInput model-value="" label="Move handoff" :disabled="!allowedHandoffStatuses(handoff.status).length" :options="[{ label: allowedHandoffStatuses(handoff.status).length ? 'Choose status' : 'No transition available', value: '' }, ...allowedHandoffStatuses(handoff.status).map(status => ({ label: statusLabel(status), value: status }))]" @change="updateHandoffStatus(handoff.id, $event)" />
          </div>
          <p class="muted text-sm leading-6 mt-4">
            {{ handoff.internalNotes || 'No internal handoff note.' }}
          </p>
          <p class="muted text-xs mt-4">
            Consent recorded {{ formatDate(handoff.consentRecordedAt) }} · Sent {{ formatDate(handoff.sentAt) }} · {{ handoff.sharedDataRoomItemIds.length }} shared item(s)
          </p>
        </article>
      </div>
      <EmptyState v-else icon="i-carbon-connect" title="No partner handoff" description="A handoff can be prepared only after next-stage review and separate applicant consent." />
      <div class="panel-inset text-sm leading-6 p-4">
        <strong>No transaction occurs here.</strong> CoFoundry does not recommend investments, handle funds or securities, or receive transaction-based compensation through this workflow.
      </div>
    </template>

    <template v-else-if="activeTab === 'audit'">
      <section class="panel p-5 md:p-6">
        <h2 class="text-lg font-semibold">
          Review audit history
        </h2><div class="surface-row-list mt-4">
          <article v-for="event in workspace.auditEvents" :key="event.id" class="surface-row">
            <div class="flex flex-wrap gap-2 items-center">
              <BaseBadge tone="neutral">
                {{ statusLabel(event.action) }}
              </BaseBadge><span class="muted text-xs">{{ formatDate(event.createdAt) }}</span>
            </div><p class="text-sm leading-6 mt-3">
              {{ event.summary }}
            </p>
          </article>
        </div>
      </section>
    </template>

    <BaseDialog :model-value="dialog === 'review'" title="Update review summary" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="saveReview">
        <SelectInput v-model="reviewForm.priority" label="Priority" :options="['standard', 'high', 'urgent'].map(value => ({ label: statusLabel(value), value }))" /><TextareaInput v-model="reviewForm.stageSummary" label="Stage summary" :rows="4" /><TextareaInput v-model="reviewForm.riskFlags" label="Risk flags" helper="One internal flag per line." :rows="4" /><BaseButton type="submit" :disabled="pending">
          Save review
        </BaseButton>
      </form>
    </BaseDialog>
    <BaseDialog :model-value="dialog === 'information'" title="Request information" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="requestInformation">
        <TextInput v-model="informationForm.title" label="Request title" /><TextareaInput v-model="informationForm.request" label="Request" :rows="5" /><TextInput v-model="informationForm.dueAt" label="Due date" type="date" /><BaseButton type="submit" :disabled="pending">
          Send request
        </BaseButton>
      </form>
    </BaseDialog>
    <BaseDialog :model-value="dialog === 'diligence'" title="Open diligence item" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="createDiligence">
        <TextInput v-model="diligenceForm.title" label="Diligence title" /><SelectInput v-model="diligenceForm.category" label="Category" :options="['pitch', 'corporate', 'financial', 'traction', 'team', 'product', 'legal', 'other'].map(value => ({ label: statusLabel(value), value }))" /><TextareaInput v-model="diligenceForm.description" label="Requested work" :rows="5" /><TextInput v-model="diligenceForm.dueAt" label="Due date" type="date" /><BaseButton type="submit" :disabled="pending">
          Open item
        </BaseButton>
      </form>
    </BaseDialog>
    <BaseDialog :model-value="dialog === 'note'" title="Add internal review note" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="addNote">
        <SelectInput v-model="noteForm.category" label="Category" :options="['screening', 'diligence', 'committee', 'compliance', 'partner'].map(value => ({ label: statusLabel(value), value }))" /><TextareaInput v-model="noteForm.body" label="Internal note" :rows="6" /><BaseButton type="submit" :disabled="pending">
          Add note
        </BaseButton>
      </form>
    </BaseDialog>
    <BaseDialog :model-value="dialog === 'decision'" title="Record review decision" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="recordDecision">
        <SelectInput v-model="decisionForm.outcome" label="Outcome" :options="['advance', 'hold', 'decline', 'refer_to_partner'].map(value => ({ label: statusLabel(value), value }))" /><TextareaInput v-model="decisionForm.publicRationale" label="Applicant-facing rationale" :rows="5" /><TextareaInput v-model="decisionForm.internalRationale" label="Internal rationale" :rows="5" /><div class="panel-inset text-sm leading-6 p-4">
          Referral means acceptance for next-stage partner preparation. It is not a financing commitment.
        </div><BaseButton type="submit" :disabled="pending">
          Record decision
        </BaseButton>
      </form>
    </BaseDialog>
    <BaseDialog :model-value="dialog === 'handoff'" title="Prepare regulated-partner handoff" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="createHandoff">
        <TextInput v-model="handoffForm.partnerName" label="Partner name" /><SelectInput v-model="handoffForm.partnerType" label="Partner type" :options="['broker_dealer', 'funding_portal', 'counsel', 'investment_adviser', 'other'].map(value => ({ label: statusLabel(value), value }))" /><TextInput v-model="handoffForm.partnerUrl" label="Partner HTTPS URL" type="url" /><TextareaInput v-model="handoffForm.internalNotes" label="Internal handoff note" :rows="4" /><fieldset>
          <legend class="text-sm font-semibold">
            Shared data-room items
          </legend><label v-for="item in cleanSharedItems" :key="item.id" class="text-sm mt-3 flex gap-3 items-start"><input v-model="handoffForm.sharedDataRoomItemIds" type="checkbox" :value="item.id" class="mt-1"><span>{{ item.title }}</span></label>
        </fieldset><BaseButton type="submit" :disabled="pending">
          Prepare handoff
        </BaseButton>
      </form>
    </BaseDialog>
  </div>

  <EmptyState v-else icon="i-carbon-warning-alt" title="Review case unavailable" description="The case may have been withdrawn or removed from the review queue." />
</template>
