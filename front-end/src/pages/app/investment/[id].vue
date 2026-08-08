<script setup lang="ts">
import type {
  InvestmentApplicantMutation,
  InvestmentDataRoomCategory,
  InvestmentInstrument,
  InvestmentInteractionType,
  InvestmentProspectKind,
  InvestmentProspectStatus,
  InvestmentRoundStatus,
  InvestmentWorkspaceStatus,
} from "~/shared/types/investment-workspaces"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Fundraising workspace")

type TabId = "overview" | "readiness" | "round" | "pipeline" | "data-room" | "application" | "diligence" | "updates" | "audit"

const route = useRoute()
const router = useRouter()
const investmentEnabled = useFeatureFlag("featureInvestmentModule")
const investmentStore = useInvestmentWorkspaceStore()
const organizationStore = useOrganizationStore()
const toastStore = useToastStore()
const workspaceId = computed(() => String(route.params.id || ""))
const pending = ref(false)
const uploadPending = ref(false)
const uploadNotice = ref("")
const dialog = ref<"round" | "prospect" | "interaction" | "data-room" | "withdraw" | "request-response" | "diligence-response" | "update" | "">("")
const selectedProspectId = ref("")
const selectedRequestId = ref("")
const selectedDiligenceId = ref("")

if (investmentEnabled.value) {
  await Promise.all([
    investmentStore.load(),
    organizationStore.load(),
  ])
}

const workspace = computed(() => investmentStore.snapshot.workspaces.find(item => item.id === workspaceId.value) || null)
const tabs: Array<{ id: TabId, icon: string, label: string }> = [
  { id: "overview", icon: "i-carbon-dashboard", label: "Overview" },
  { id: "readiness", icon: "i-carbon-checkmark-outline", label: "Readiness" },
  { id: "round", icon: "i-carbon-chart-line", label: "Round" },
  { id: "pipeline", icon: "i-carbon-user-multiple", label: "Private pipeline" },
  { id: "data-room", icon: "i-carbon-folder", label: "Data room" },
  { id: "application", icon: "i-carbon-document", label: "Program application" },
  { id: "diligence", icon: "i-carbon-task", label: "Requests" },
  { id: "updates", icon: "i-carbon-report-data", label: "Updates" },
  { id: "audit", icon: "i-carbon-document-tasks", label: "Audit" },
]
const activeTab = computed<TabId>(() => tabs.some(tab => tab.id === route.query.view) ? route.query.view as TabId : "overview")
const editableApplication = computed(() => ["draft", "information_requested"].includes(workspace.value?.application.status || ""))
const canSubmit = computed(() => {
  const application = workspace.value?.application
  if (!editableApplication.value || !application || application.supplementalTermsVersion !== investmentStore.snapshot.supplementalTermsVersion)
    return false

  return application.attestations.authorizedToSubmit
    && application.attestations.informationAccurate
    && application.attestations.noFundingGuarantee
    && application.attestations.regulatedExecutionAcknowledged
    && [
      application.requestedAmount,
      application.companySummary,
      application.traction,
      application.teamSummary,
      application.useOfFunds,
      application.fundraisingHistory,
      application.reason,
      application.deckUrl,
    ].every(Boolean)
})
const organizationOptions = computed(() => organizationStore.snapshot.workspaces.map(item => ({ label: item.organization.name, value: item.organization.id })))

const readinessForm = reactive({
  capTableCurrent: false,
  counselEngaged: false,
  dataRoomReady: false,
  financialsCurrent: false,
  formationComplete: false,
  formationJurisdiction: "",
  fundraisingOwner: "",
  legalName: "",
  notes: "",
  targetCloseAt: "",
})
const roundForm = reactive({ discount: "", instrument: "safe" as InvestmentInstrument, minimumInvestment: "", openedAt: "", targetAmount: "", targetCloseAt: "", title: "", useOfFunds: "", valuationCap: "" })
const prospectForm = reactive({ email: "", expectedCheckSize: "", firm: "", kind: "fund" as InvestmentProspectKind, name: "", nextStep: "", nextStepAt: "", notes: "", source: "", status: "researching" as InvestmentProspectStatus, website: "" })
const interactionForm = reactive({ nextStep: "", occurredAt: "", summary: "", type: "note" as InvestmentInteractionType })
const dataRoomForm = reactive({ category: "pitch" as InvestmentDataRoomCategory, description: "", externalUrl: "", fileUploadId: null as string | null, shareWithProgram: false, title: "" })
const applicationForm = reactive({ companySummary: "", deckUrl: "", fundraisingHistory: "", instrument: "safe" as InvestmentInstrument, reason: "", requestedAmount: "", teamSummary: "", traction: "", useOfFunds: "" })
const termsForm = reactive({ authorizedToSubmit: false, informationAccurate: false, noFundingGuarantee: false, regulatedExecutionAcknowledged: false })
const responseForm = reactive({ evidenceDataRoomItemIds: [] as string[], response: "", status: "submitted" as "in_progress" | "submitted" })
const updateForm = reactive({ body: "", metrics: "", shareWithProgram: false, title: "" })
const withdrawalReason = ref("")

watch(workspace, (current) => {
  if (!current)
    return
  Object.assign(readinessForm, {
    ...current.readiness,
    targetCloseAt: current.readiness.targetCloseAt?.slice(0, 10) || "",
    updatedAt: undefined,
  })
  Object.assign(applicationForm, {
    companySummary: current.application.companySummary,
    deckUrl: current.application.deckUrl,
    fundraisingHistory: current.application.fundraisingHistory,
    instrument: current.application.instrument,
    reason: current.application.reason,
    requestedAmount: current.application.requestedAmount,
    teamSummary: current.application.teamSummary,
    traction: current.application.traction,
    useOfFunds: current.application.useOfFunds,
  })
  Object.assign(termsForm, {
    authorizedToSubmit: current.application.attestations.authorizedToSubmit,
    informationAccurate: current.application.attestations.informationAccurate,
    noFundingGuarantee: current.application.attestations.noFundingGuarantee,
    regulatedExecutionAcknowledged: current.application.attestations.regulatedExecutionAcknowledged,
  })
}, { immediate: true })

function statusLabel(status: string) {
  return status.replaceAll("_", " ")
}

function statusTone(status: string) {
  if (["accepted", "closed", "committed", "uploaded", "accepted"].includes(status))
    return "success" as const
  if (["declined", "information_requested", "withdrawn", "passed", "blocked"].includes(status))
    return "warning" as const
  if (["submitted", "under_review", "diligence", "committee_review", "open", "meeting"].includes(status))
    return "accent" as const
  return "neutral" as const
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value)) : "Not set"
}

function fileUpload(uploadId: string | null) {
  return uploadId ? investmentStore.snapshot.fileUploads.find(item => item.id === uploadId) || null : null
}

function fileIsDownloadable(uploadId: string | null) {
  const upload = fileUpload(uploadId)
  return upload?.status === "uploaded" && upload.scanStatus === "clean"
}

function toIsoDate(value: string) {
  return value ? new Date(`${value}T17:00:00`).toISOString() : null
}

function errorMessage(error: unknown) {
  const payload = error as { data?: { message?: string }, statusMessage?: string }
  return payload.data?.message || payload.statusMessage || "The fundraising change could not be saved."
}

async function selectTab(tab: TabId) {
  await router.replace({ query: { ...route.query, view: tab === "overview" ? undefined : tab } })
}

async function mutate(mutation: InvestmentApplicantMutation, message: string) {
  if (!workspace.value)
    return null
  pending.value = true
  try {
    const result = await investmentStore.mutate(workspace.value, mutation)
    toastStore.push({ message, title: "Fundraising workspace updated", tone: "success" })
    return result
  }
  catch (error) {
    await investmentStore.load(true).catch(() => undefined)
    toastStore.push({ message: errorMessage(error), title: "Change not saved", tone: "danger" })
    return null
  }
  finally {
    pending.value = false
  }
}

async function updateWorkspaceStatus(event: Event) {
  if (!workspace.value)
    return
  await mutate({
    action: "update_workspace",
    organizationId: workspace.value.organizationId,
    status: (event.target as HTMLSelectElement).value as Exclude<InvestmentWorkspaceStatus, "closed">,
  }, "Workspace status updated.")
}

async function updateOrganization(event: Event) {
  if (!workspace.value)
    return
  await mutate({
    action: "update_workspace",
    organizationId: (event.target as HTMLSelectElement).value || null,
    status: workspace.value.status === "closed" ? "paused" : workspace.value.status,
  }, "Organization link updated.")
}

async function saveReadiness() {
  await mutate({
    action: "update_readiness",
    profile: {
      capTableCurrent: readinessForm.capTableCurrent,
      counselEngaged: readinessForm.counselEngaged,
      dataRoomReady: readinessForm.dataRoomReady,
      financialsCurrent: readinessForm.financialsCurrent,
      formationComplete: readinessForm.formationComplete,
      formationJurisdiction: readinessForm.formationJurisdiction,
      fundraisingOwner: readinessForm.fundraisingOwner,
      legalName: readinessForm.legalName,
      notes: readinessForm.notes,
      targetCloseAt: toIsoDate(readinessForm.targetCloseAt),
    },
  }, "Readiness checklist saved.")
}

async function createRound() {
  if (!await mutate({
    action: "create_round",
    discount: roundForm.discount,
    instrument: roundForm.instrument,
    minimumInvestment: roundForm.minimumInvestment,
    openedAt: toIsoDate(roundForm.openedAt),
    targetAmount: roundForm.targetAmount,
    targetCloseAt: toIsoDate(roundForm.targetCloseAt),
    title: roundForm.title,
    useOfFunds: roundForm.useOfFunds,
    valuationCap: roundForm.valuationCap,
  }, `${roundForm.title} created.`)) {
    return
  }
  Object.assign(roundForm, { discount: "", instrument: "safe", minimumInvestment: "", openedAt: "", targetAmount: "", targetCloseAt: "", title: "", useOfFunds: "", valuationCap: "" })
  dialog.value = ""
}

async function updateRoundStatus(roundId: string, event: Event) {
  const round = workspace.value?.rounds.find(item => item.id === roundId)
  if (!round)
    return
  await mutate({
    action: "update_round",
    discount: round.discount,
    instrument: round.instrument,
    minimumInvestment: round.minimumInvestment,
    openedAt: round.openedAt,
    roundId,
    status: (event.target as HTMLSelectElement).value as InvestmentRoundStatus,
    targetAmount: round.targetAmount,
    targetCloseAt: round.targetCloseAt,
    title: round.title,
    useOfFunds: round.useOfFunds,
    valuationCap: round.valuationCap,
  }, `${round.title} status updated.`)
}

async function createProspect() {
  if (!await mutate({ action: "create_prospect", ...prospectForm, nextStepAt: toIsoDate(prospectForm.nextStepAt) }, `${prospectForm.name || prospectForm.firm} added to your private pipeline.`))
    return
  Object.assign(prospectForm, { email: "", expectedCheckSize: "", firm: "", kind: "fund", name: "", nextStep: "", nextStepAt: "", notes: "", source: "", status: "researching", website: "" })
  dialog.value = ""
}

async function updateProspectStatus(prospectId: string, event: Event) {
  const prospect = workspace.value?.prospects.find(item => item.id === prospectId)
  if (!prospect)
    return
  await mutate({
    action: "update_prospect",
    email: prospect.email,
    expectedCheckSize: prospect.expectedCheckSize,
    firm: prospect.firm,
    kind: prospect.kind,
    name: prospect.name,
    nextStep: prospect.nextStep,
    nextStepAt: prospect.nextStepAt,
    notes: prospect.notes,
    prospectId,
    source: prospect.source,
    status: (event.target as HTMLSelectElement).value as InvestmentProspectStatus,
    website: prospect.website,
  }, `${prospect.name || prospect.firm} updated.`)
}

function openInteraction(prospectId: string) {
  selectedProspectId.value = prospectId
  interactionForm.occurredAt = new Date().toISOString().slice(0, 16)
  dialog.value = "interaction"
}

async function recordInteraction() {
  if (!selectedProspectId.value)
    return
  if (!await mutate({
    action: "record_interaction",
    nextStep: interactionForm.nextStep,
    occurredAt: new Date(interactionForm.occurredAt).toISOString(),
    prospectId: selectedProspectId.value,
    summary: interactionForm.summary,
    type: interactionForm.type,
  }, "Private interaction recorded.")) {
    return
  }
  Object.assign(interactionForm, { nextStep: "", occurredAt: "", summary: "", type: "note" })
  selectedProspectId.value = ""
  dialog.value = ""
}

function inferMimeType(file: File) {
  if (file.type)
    return file.type
  const extension = file.name.split(".").pop()?.toLowerCase()
  return extension === "pdf" ? "application/pdf" : extension === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : extension === "txt" ? "text/plain" : ""
}

async function uploadDataRoomFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""
  if (!file || !workspace.value)
    return
  uploadPending.value = true
  uploadNotice.value = ""
  try {
    const mimeType = inferMimeType(file)
    const { policy } = await $fetch<{ policy: { id: string, method: "PUT", signedUploadUrl: string | null, uploadToken: string | null } }>("/api/files/upload-policy", {
      body: {
        filename: file.name,
        mimeType,
        purpose: "investment_document",
        relatedId: workspace.value.id,
        relatedType: "investment_workspace",
        sizeBytes: file.size,
      },
      method: "POST",
    })
    if (!policy.signedUploadUrl)
      throw new Error("Upload URL was not created.")
    const response = await fetch(policy.signedUploadUrl, {
      body: file,
      headers: { "content-type": mimeType, ...(policy.uploadToken ? { "x-cofoundry-upload-token": policy.uploadToken } : {}) },
      method: policy.method,
    })
    if (!response.ok)
      throw new Error("The upload could not be completed.")
    dataRoomForm.fileUploadId = policy.id
    dataRoomForm.shareWithProgram = false
    if (!dataRoomForm.title)
      dataRoomForm.title = file.name
    uploadNotice.value = `${file.name} uploaded. Add it privately now; program sharing becomes available after malware review.`
  }
  catch (error) {
    uploadNotice.value = errorMessage(error)
  }
  finally {
    uploadPending.value = false
  }
}

async function addDataRoomItem() {
  if (!await mutate({ action: "add_data_room_item", ...dataRoomForm }, `${dataRoomForm.title} added to the data room.`))
    return
  Object.assign(dataRoomForm, { category: "pitch", description: "", externalUrl: "", fileUploadId: null, shareWithProgram: false, title: "" })
  uploadNotice.value = ""
  dialog.value = ""
  await investmentStore.load(true)
}

async function toggleDataRoomSharing(itemId: string, event: Event) {
  const item = workspace.value?.dataRoomItems.find(candidate => candidate.id === itemId)
  if (!item)
    return
  await mutate({
    action: "update_data_room_item",
    category: item.category,
    dataRoomItemId: item.id,
    description: item.description,
    externalUrl: item.externalUrl,
    shareWithProgram: (event.target as HTMLInputElement).checked,
    title: item.title,
  }, `${item.title} sharing updated.`)
}

async function saveApplication() {
  await mutate({ action: "update_application", ...applicationForm }, "Program application draft saved.")
}

async function acceptTerms() {
  await mutate({ action: "accept_supplemental_terms", attestations: { ...termsForm } }, `Supplemental terms ${investmentStore.snapshot.supplementalTermsVersion} accepted.`)
}

async function submitApplication() {
  await mutate({ action: "submit_application" }, "Application submitted for program review.")
}

async function withdrawApplication() {
  if (!await mutate({ action: "withdraw_application", reason: withdrawalReason.value }, "Application withdrawn."))
    return
  withdrawalReason.value = ""
  dialog.value = ""
}

async function setPartnerConsent(event: Event) {
  const consent = (event.target as HTMLInputElement).checked
  await mutate({ action: "set_partner_sharing_consent", consent }, consent ? "Regulated-partner sharing consent recorded." : "Future partner sharing consent withdrawn.")
}

function openRequestResponse(requestId: string) {
  selectedRequestId.value = requestId
  responseForm.response = ""
  dialog.value = "request-response"
}

function openDiligenceResponse(itemId: string) {
  selectedDiligenceId.value = itemId
  responseForm.response = ""
  responseForm.evidenceDataRoomItemIds = []
  responseForm.status = "submitted"
  dialog.value = "diligence-response"
}

async function respondToRequest() {
  if (!selectedRequestId.value)
    return
  if (!await mutate({ action: "respond_information_request", informationRequestId: selectedRequestId.value, response: responseForm.response }, "Information response submitted."))
    return
  selectedRequestId.value = ""
  dialog.value = ""
}

async function respondToDiligence() {
  if (!selectedDiligenceId.value)
    return
  if (!await mutate({ action: "respond_diligence_item", diligenceItemId: selectedDiligenceId.value, ...responseForm }, "Diligence response updated."))
    return
  selectedDiligenceId.value = ""
  dialog.value = ""
}

async function publishUpdate() {
  if (!await mutate({ action: "publish_founder_update", ...updateForm }, `${updateForm.title} published.`))
    return
  Object.assign(updateForm, { body: "", metrics: "", shareWithProgram: false, title: "" })
  dialog.value = ""
}

async function toggleUpdateSharing(updateId: string, event: Event) {
  const update = workspace.value?.founderUpdates.find(item => item.id === updateId)
  if (!update)
    return
  await mutate({ action: "update_founder_update", body: update.body, founderUpdateId: update.id, metrics: update.metrics, shareWithProgram: (event.target as HTMLInputElement).checked, title: update.title }, `${update.title} sharing updated.`)
}
</script>

<template>
  <div v-if="!investmentEnabled" class="gap-6 grid">
    <PageIntro eyebrow="Fundraising" title="Workspace disabled" description="This deployment has not enabled the separately governed fundraising workspace." />
    <EmptyState icon="i-carbon-locked" title="Fundraising workspace disabled" description="Return to the main workspace." />
  </div>

  <div v-else-if="workspace" class="gap-6 grid">
    <PageIntro eyebrow="Fundraising workspace" :title="workspace.companyName" :description="workspace.application.companySummary || 'Readiness, outreach, diligence, and program review in one applicant-controlled workspace.'">
      <template #actions>
        <BaseBadge :tone="statusTone(workspace.application.status)">
          {{ statusLabel(workspace.application.status) }}
        </BaseBadge><BaseButton variant="secondary" to="/app/investment">
          <span class="i-carbon-arrow-left" />All workspaces
        </BaseButton>
      </template>
    </PageIntro>

    <div class="overflow-x-auto">
      <div class="p-1 border border-[var(--line)] rounded-xl bg-[var(--panel-inset)] inline-flex gap-1 min-w-max" role="tablist" aria-label="Fundraising workspace views">
        <button v-for="tab in tabs" :key="tab.id" type="button" role="tab" :aria-selected="activeTab === tab.id" class="text-sm font-semibold px-3 py-2 rounded-lg inline-flex gap-2 transition items-center" :class="activeTab === tab.id ? 'bg-[var(--panel-strong)] text-[var(--text)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--text)]'" @click="selectTab(tab.id)">
          <span :class="tab.icon" />{{ tab.label }}
        </button>
      </div>
    </div>

    <template v-if="activeTab === 'overview'">
      <div class="gap-4 grid sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Round target" :value="workspace.rounds[0]?.targetAmount || workspace.application.requestedAmount || 'Planning'" context="Applicant-defined amount" /><MetricTile label="Private prospects" :value="workspace.prospects.length" context="Invisible to program staff" /><MetricTile label="Shared records" :value="workspace.dataRoomItems.filter(item => item.shareWithProgram).length" :context="`${workspace.dataRoomItems.length} total data-room records`" /><MetricTile label="Open requests" :value="workspace.informationRequests.filter(item => ['open', 'answered'].includes(item.status)).length + workspace.diligenceItems.filter(item => ['open', 'in_progress', 'submitted'].includes(item.status)).length" context="Program follow-up" />
      </div>
      <div class="gap-6 grid xl:grid-cols-2">
        <section class="panel p-5 md:p-6">
          <h2 class="text-lg font-semibold">
            Workspace settings
          </h2><div class="mt-5 gap-4 grid sm:grid-cols-2">
            <SelectInput :model-value="workspace.status" label="Workspace status" :options="['planning', 'fundraising', 'paused'].map(value => ({ label: statusLabel(value), value }))" @change="updateWorkspaceStatus" /><SelectInput :model-value="workspace.organizationId || ''" label="Team or Studio" :options="[{ label: 'No organization link', value: '' }, ...organizationOptions]" @change="updateOrganization" />
          </div><div class="panel-inset text-sm leading-6 mt-5 p-4">
            Organization linking exposes the program record and internal approval surface to authorized Team or Studio members. It does not expose your private outreach pipeline.
          </div>
        </section>
        <section class="panel p-5 md:p-6">
          <div class="flex gap-3 items-center justify-between">
            <h2 class="text-lg font-semibold">
              Program state
            </h2><BaseBadge :tone="statusTone(workspace.application.status)">
              {{ statusLabel(workspace.application.status) }}
            </BaseBadge>
          </div><dl class="surface-row-list mt-4">
            <div class="surface-row">
              <dt class="muted text-sm">
                Submitted
              </dt><dd class="font-semibold mt-1">
                {{ formatDate(workspace.application.submittedAt) }}
              </dd>
            </div><div class="surface-row">
              <dt class="muted text-sm">
                Last reviewed
              </dt><dd class="font-semibold mt-1">
                {{ formatDate(workspace.review.lastReviewedAt) }}
              </dd>
            </div><div class="surface-row">
              <dt class="muted text-sm">
                Application revision
              </dt><dd class="font-semibold mt-1">
                {{ workspace.application.submissionRevision }}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <section v-if="workspace.decisions.length || workspace.partnerHandoffs.length" class="panel p-5 md:p-6">
        <h2 class="text-lg font-semibold">
          Program outcomes
        </h2><div class="surface-row-list mt-4">
          <article v-for="decision in workspace.decisions" :key="decision.id" class="surface-row">
            <div class="flex gap-2 items-center">
              <BaseBadge :tone="statusTone(decision.outcome)">
                {{ statusLabel(decision.outcome) }}
              </BaseBadge><span class="muted text-xs">{{ formatDate(decision.decidedAt) }}</span>
            </div><p class="text-sm leading-6 mt-3">
              {{ decision.publicRationale }}
            </p>
          </article><article v-for="handoff in workspace.partnerHandoffs" :key="handoff.id" class="surface-row">
            <div class="flex gap-2 items-center">
              <BaseBadge :tone="statusTone(handoff.status)">
                {{ statusLabel(handoff.status) }}
              </BaseBadge><strong>{{ handoff.partnerName }}</strong>
            </div><p class="muted text-sm leading-6 mt-3">
              Next-stage regulated-partner preparation. No funding commitment is created by this status.
            </p>
          </article>
        </div>
      </section>
    </template>

    <template v-else-if="activeTab === 'readiness'">
      <form class="panel p-5 gap-5 grid md:p-6" @submit.prevent="saveReadiness">
        <div>
          <h2 class="text-lg font-semibold">
            Fundraising readiness
          </h2><p class="muted text-sm leading-6 mt-2">
            Record your operating state; these are applicant attestations, not CoFoundry verification.
          </p>
        </div><div class="gap-4 grid md:grid-cols-2">
          <TextInput v-model="readinessForm.legalName" label="Legal company name" /><TextInput v-model="readinessForm.formationJurisdiction" label="Formation jurisdiction" /><TextInput v-model="readinessForm.fundraisingOwner" label="Fundraising owner" /><TextInput v-model="readinessForm.targetCloseAt" label="Target close date" type="date" />
        </div><fieldset class="gap-3 grid sm:grid-cols-2">
          <legend class="text-sm font-semibold mb-2">
            Readiness checklist
          </legend><label v-for="item in [{ key: 'formationComplete', label: 'Formation complete' }, { key: 'capTableCurrent', label: 'Cap table current' }, { key: 'financialsCurrent', label: 'Financials current' }, { key: 'dataRoomReady', label: 'Data room ready' }, { key: 'counselEngaged', label: 'Counsel engaged' }]" :key="item.key" class="panel-inset text-sm p-3 flex gap-3 items-center"><input v-model="readinessForm[item.key as keyof typeof readinessForm]" type="checkbox"><span>{{ item.label }}</span></label>
        </fieldset><TextareaInput v-model="readinessForm.notes" label="Readiness notes" :rows="5" /><div class="flex justify-end">
          <BaseButton type="submit" :disabled="pending">
            <span class="i-carbon-save" />Save readiness
          </BaseButton>
        </div>
      </form>
    </template>

    <template v-else-if="activeTab === 'round'">
      <div class="flex justify-end">
        <BaseButton @click="dialog = 'round'">
          <span class="i-carbon-add" />Add round
        </BaseButton>
      </div><div v-if="workspace.rounds.length" class="gap-4 grid">
        <article v-for="round in workspace.rounds" :key="round.id" class="panel p-5 md:p-6">
          <div class="flex flex-wrap gap-4 items-start justify-between">
            <div>
              <div class="flex gap-2">
                <BaseBadge :tone="statusTone(round.status)">
                  {{ statusLabel(round.status) }}
                </BaseBadge><BaseBadge tone="neutral">
                  {{ statusLabel(round.instrument) }}
                </BaseBadge>
              </div><h2 class="text-lg font-semibold mt-3">
                {{ round.title }}
              </h2><p class="muted text-sm leading-6 mt-2">
                {{ round.useOfFunds }}
              </p>
            </div><SelectInput :model-value="round.status" label="Round status" :options="['planning', 'open', 'soft_circled', 'closed', 'canceled'].map(value => ({ label: statusLabel(value), value }))" @change="updateRoundStatus(round.id, $event)" />
          </div><div class="mt-5 gap-4 grid grid-cols-2 md:grid-cols-4">
            <div>
              <p class="muted text-xs uppercase">
                Target
              </p><p class="font-semibold mt-1">
                {{ round.targetAmount }}
              </p>
            </div><div>
              <p class="muted text-xs uppercase">
                Minimum
              </p><p class="font-semibold mt-1">
                {{ round.minimumInvestment || 'Not set' }}
              </p>
            </div><div>
              <p class="muted text-xs uppercase">
                Valuation cap
              </p><p class="font-semibold mt-1">
                {{ round.valuationCap || 'Not set' }}
              </p>
            </div><div>
              <p class="muted text-xs uppercase">
                Target close
              </p><p class="font-semibold mt-1">
                {{ formatDate(round.targetCloseAt) }}
              </p>
            </div>
          </div>
        </article>
      </div><EmptyState v-else icon="i-carbon-chart-line" title="No fundraising round" description="Add a founder-defined round to track target, instrument, timing, and use of funds." />
    </template>

    <template v-else-if="activeTab === 'pipeline'">
      <div class="panel-inset text-sm leading-6 p-4 flex gap-3 items-start">
        <span class="i-carbon-locked text-[var(--accent)] mt-1" /><p class="muted">
          <strong class="text-[var(--text)]">Private from program staff.</strong> CoFoundry does not discover, rank, recommend, or contact investors through this pipeline.
        </p>
      </div><div class="flex justify-end">
        <BaseButton @click="dialog = 'prospect'">
          <span class="i-carbon-user-follow" />Add prospect
        </BaseButton>
      </div><div v-if="workspace.prospects.length" class="gap-4 grid">
        <article v-for="prospect in workspace.prospects" :key="prospect.id" class="panel p-5 md:p-6">
          <div class="gap-4 grid md:grid-cols-[minmax(0,1fr)_200px_auto] md:items-start">
            <div>
              <div class="flex flex-wrap gap-2">
                <BaseBadge :tone="statusTone(prospect.status)">
                  {{ statusLabel(prospect.status) }}
                </BaseBadge><BaseBadge tone="neutral">
                  {{ statusLabel(prospect.kind) }}
                </BaseBadge>
              </div><h2 class="font-semibold mt-3">
                {{ prospect.name || prospect.firm }}
              </h2><p v-if="prospect.name && prospect.firm" class="muted text-sm mt-1">
                {{ prospect.firm }}
              </p><p class="muted text-sm leading-6 mt-3">
                {{ prospect.notes || prospect.nextStep }}
              </p>
            </div><SelectInput :model-value="prospect.status" label="Pipeline status" :options="['researching', 'contact_planned', 'contacted', 'meeting', 'diligence', 'passed', 'committed', 'closed'].map(value => ({ label: statusLabel(value), value }))" @change="updateProspectStatus(prospect.id, $event)" /><BaseButton size="sm" variant="secondary" @click="openInteraction(prospect.id)">
              <span class="i-carbon-add-comment" />Interaction
            </BaseButton>
          </div><div class="mt-4 gap-3 grid sm:grid-cols-3">
            <div>
              <p class="muted text-xs uppercase">
                Expected check
              </p><p class="text-sm font-semibold mt-1">
                {{ prospect.expectedCheckSize || 'Not set' }}
              </p>
            </div><div>
              <p class="muted text-xs uppercase">
                Next step
              </p><p class="text-sm font-semibold mt-1">
                {{ prospect.nextStep || 'Not set' }}
              </p>
            </div><div>
              <p class="muted text-xs uppercase">
                Next date
              </p><p class="text-sm font-semibold mt-1">
                {{ formatDate(prospect.nextStepAt) }}
              </p>
            </div>
          </div><div v-if="workspace.interactions.some(item => item.prospectId === prospect.id)" class="surface-row-list mt-4">
            <div v-for="item in workspace.interactions.filter(candidate => candidate.prospectId === prospect.id)" :key="item.id" class="surface-row">
              <div class="flex gap-2">
                <BaseBadge tone="neutral">
                  {{ statusLabel(item.type) }}
                </BaseBadge><span class="muted text-xs">{{ formatDate(item.occurredAt) }}</span>
              </div><p class="text-sm leading-6 mt-2">
                {{ item.summary }}
              </p>
            </div>
          </div>
        </article>
      </div><EmptyState v-else icon="i-carbon-user-multiple" title="No private prospects" description="Add contacts you already know or independently identify, then track founder-owned outreach." />
    </template>

    <template v-else-if="activeTab === 'data-room'">
      <div class="flex flex-wrap gap-3 items-center justify-between">
        <div class="panel-inset text-sm leading-6 p-4 flex-1">
          Program staff can access only items marked <strong>Shared with program</strong>. Uploaded files must pass malware review before sharing.
        </div><BaseButton @click="dialog = 'data-room'">
          <span class="i-carbon-add" />Add record
        </BaseButton>
      </div><div v-if="workspace.dataRoomItems.length" class="gap-4 grid md:grid-cols-2">
        <article v-for="item in workspace.dataRoomItems" :key="item.id" class="panel p-5">
          <div class="flex gap-3 items-start justify-between">
            <div>
              <div class="flex flex-wrap gap-2">
                <BaseBadge tone="neutral">
                  {{ statusLabel(item.category) }}
                </BaseBadge><BaseBadge v-if="item.fileUploadId" :tone="statusTone(fileUpload(item.fileUploadId)?.scanStatus || 'pending')">
                  {{ statusLabel(fileUpload(item.fileUploadId)?.scanStatus || 'pending scan') }}
                </BaseBadge>
              </div><h2 class="font-semibold mt-3">
                {{ item.title }}
              </h2>
            </div><label class="text-xs font-semibold flex gap-2 items-center"><input type="checkbox" :checked="item.shareWithProgram" @change="toggleDataRoomSharing(item.id, $event)">Shared</label>
          </div><p class="muted text-sm leading-6 mt-3">
            {{ item.description }}
          </p><div class="mt-4 flex flex-wrap gap-2">
            <BaseButton v-if="fileIsDownloadable(item.fileUploadId)" size="sm" variant="secondary" :href="`/api/files/${item.fileUploadId}/download`">
              <span class="i-carbon-download" />Download
            </BaseButton><BaseButton v-if="item.externalUrl" size="sm" variant="secondary" :href="item.externalUrl">
              <span class="i-carbon-launch" />Open link
            </BaseButton><BaseButton size="sm" variant="ghost" aria-label="Remove data-room item" @click="mutate({ action: 'remove_data_room_item', dataRoomItemId: item.id }, `${item.title} removed.`)">
              <span class="i-carbon-trash-can" />
            </BaseButton>
          </div>
        </article>
      </div><EmptyState v-else icon="i-carbon-folder" title="Data room empty" description="Add secure links or private uploaded records, then choose what enters program review." />
    </template>

    <template v-else-if="activeTab === 'application'">
      <form class="panel p-5 gap-5 grid md:p-6" @submit.prevent="saveApplication">
        <div class="flex flex-wrap gap-3 items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold">
              Program application
            </h2><p class="muted text-sm leading-6 mt-2">
              Application fields lock after submission unless staff requests additional information.
            </p>
          </div><BaseBadge :tone="statusTone(workspace.application.status)">
            {{ statusLabel(workspace.application.status) }}
          </BaseBadge>
        </div><div class="gap-4 grid md:grid-cols-2">
          <TextInput v-model="applicationForm.requestedAmount" label="Requested amount" :required="true" :disabled="!editableApplication" /><SelectInput v-model="applicationForm.instrument" label="Instrument" :disabled="!editableApplication" :options="['safe', 'convertible_note', 'preferred_equity', 'other'].map(value => ({ label: statusLabel(value), value }))" /><TextInput v-model="applicationForm.deckUrl" label="Deck HTTPS URL" type="url" :required="true" :disabled="!editableApplication" /><div class="hidden md:block" />
        </div><TextareaInput v-model="applicationForm.companySummary" label="Company summary" :rows="4" :disabled="!editableApplication" /><TextareaInput v-model="applicationForm.traction" label="Traction" :rows="4" :disabled="!editableApplication" /><TextareaInput v-model="applicationForm.teamSummary" label="Team summary" :rows="4" :disabled="!editableApplication" /><TextareaInput v-model="applicationForm.useOfFunds" label="Use of funds" :rows="4" :disabled="!editableApplication" /><TextareaInput v-model="applicationForm.fundraisingHistory" label="Fundraising history" :rows="4" :disabled="!editableApplication" /><TextareaInput v-model="applicationForm.reason" label="Why this program" :rows="4" :disabled="!editableApplication" /><div class="flex justify-end">
          <BaseButton type="submit" :disabled="pending || !editableApplication">
            <span class="i-carbon-save" />Save application
          </BaseButton>
        </div>
      </form>
      <section class="panel p-5 md:p-6">
        <h2 class="text-lg font-semibold">
          Supplemental terms and attestations
        </h2><p class="muted text-sm leading-6 mt-2">
          Current version: {{ investmentStore.snapshot.supplementalTermsVersion }} · Accepted version: {{ workspace.application.supplementalTermsVersion || 'none' }}
        </p><div class="mt-5 gap-3 grid">
          <label class="text-sm flex gap-3 items-start"><input v-model="termsForm.authorizedToSubmit" type="checkbox" class="mt-1" :disabled="!editableApplication"><span>I am authorized to submit this information for the company.</span></label><label class="text-sm flex gap-3 items-start"><input v-model="termsForm.informationAccurate" type="checkbox" class="mt-1" :disabled="!editableApplication"><span>The submitted information is accurate to the best of my knowledge.</span></label><label class="text-sm flex gap-3 items-start"><input v-model="termsForm.noFundingGuarantee" type="checkbox" class="mt-1" :disabled="!editableApplication"><span>I understand submission and acceptance do not guarantee financing.</span></label><label class="text-sm flex gap-3 items-start"><input v-model="termsForm.regulatedExecutionAcknowledged" type="checkbox" class="mt-1" :disabled="!editableApplication"><span>I understand securities activity, if any, occurs outside CoFoundry through qualified counsel and registered intermediaries when required.</span></label>
        </div><div class="mt-5 flex flex-wrap gap-3">
          <BaseButton variant="secondary" :disabled="pending || !editableApplication" @click="acceptTerms">
            <span class="i-carbon-document-signed" />Accept current terms
          </BaseButton><BaseButton :disabled="pending || !canSubmit" @click="submitApplication">
            <span class="i-carbon-send" />Submit application
          </BaseButton><BaseButton v-if="['submitted', 'under_review', 'information_requested', 'diligence', 'committee_review'].includes(workspace.application.status)" variant="ghost" @click="dialog = 'withdraw'">
            <span class="i-carbon-close" />Withdraw
          </BaseButton>
        </div>
      </section>
      <section class="panel p-5 md:p-6">
        <div class="flex gap-4 items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold">
              Regulated-partner sharing
            </h2><p class="muted text-sm leading-6 mt-2">
              Separate consent applies only to a later, identified partner handoff. It is not required to submit the application.
            </p>
          </div><label class="inline-flex gap-3 items-center"><input type="checkbox" :checked="workspace.application.attestations.regulatedPartnerSharingConsent" @change="setPartnerConsent"><span class="text-sm font-semibold">Consent</span></label>
        </div><div v-if="workspace.partnerHandoffs.length" class="surface-row-list mt-4">
          <article v-for="handoff in workspace.partnerHandoffs" :key="handoff.id" class="surface-row">
            <div class="flex gap-2">
              <BaseBadge :tone="statusTone(handoff.status)">
                {{ statusLabel(handoff.status) }}
              </BaseBadge><strong>{{ handoff.partnerName }}</strong>
            </div><p class="muted text-sm mt-2">
              {{ statusLabel(handoff.partnerType) }} · {{ handoff.sharedDataRoomItemIds.length }} shared record(s)
            </p>
          </article>
        </div>
      </section>
    </template>

    <template v-else-if="activeTab === 'diligence'">
      <section class="panel p-5 md:p-6">
        <h2 class="text-lg font-semibold">
          Information requests
        </h2><div v-if="workspace.informationRequests.length" class="surface-row-list mt-4">
          <article v-for="item in workspace.informationRequests" :key="item.id" class="surface-row">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div>
                <BaseBadge :tone="statusTone(item.status)">
                  {{ statusLabel(item.status) }}
                </BaseBadge><h3 class="font-semibold mt-3">
                  {{ item.title }}
                </h3>
              </div><BaseButton v-if="item.status === 'open'" size="sm" @click="openRequestResponse(item.id)">
                <span class="i-carbon-reply" />Respond
              </BaseButton>
            </div><p class="muted text-sm leading-6 mt-3">
              {{ item.request }}
            </p><div v-if="item.response" class="panel-inset text-sm leading-6 mt-4 p-4">
              {{ item.response }}
            </div>
          </article>
        </div><p v-else class="muted text-sm mt-4">
          No information requests.
        </p>
      </section>
      <section class="panel p-5 md:p-6">
        <h2 class="text-lg font-semibold">
          Diligence items
        </h2><div v-if="workspace.diligenceItems.length" class="surface-row-list mt-4">
          <article v-for="item in workspace.diligenceItems" :key="item.id" class="surface-row">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div>
                <div class="flex gap-2">
                  <BaseBadge :tone="statusTone(item.status)">
                    {{ statusLabel(item.status) }}
                  </BaseBadge><BaseBadge tone="neutral">
                    {{ statusLabel(item.category) }}
                  </BaseBadge>
                </div><h3 class="font-semibold mt-3">
                  {{ item.title }}
                </h3>
              </div><BaseButton v-if="['open', 'in_progress', 'submitted'].includes(item.status)" size="sm" @click="openDiligenceResponse(item.id)">
                <span class="i-carbon-reply" />Update response
              </BaseButton>
            </div><p class="muted text-sm leading-6 mt-3">
              {{ item.description }}
            </p><div v-if="item.response" class="panel-inset text-sm leading-6 mt-4 p-4">
              {{ item.response }}
            </div><p class="muted text-xs mt-3">
              Due {{ formatDate(item.dueAt) }}
            </p>
          </article>
        </div><p v-else class="muted text-sm mt-4">
          No diligence items.
        </p>
      </section>
    </template>

    <template v-else-if="activeTab === 'updates'">
      <div class="flex justify-end">
        <BaseButton @click="dialog = 'update'">
          <span class="i-carbon-add" />Publish update
        </BaseButton>
      </div><div v-if="workspace.founderUpdates.length" class="gap-4 grid">
        <article v-for="update in workspace.founderUpdates" :key="update.id" class="panel p-5 md:p-6">
          <div class="flex gap-3 items-start justify-between">
            <div>
              <p class="section-kicker">
                {{ formatDate(update.createdAt) }}
              </p><h2 class="text-lg font-semibold mt-2">
                {{ update.title }}
              </h2>
            </div><label class="text-xs font-semibold flex gap-2 items-center"><input type="checkbox" :checked="update.shareWithProgram" @change="toggleUpdateSharing(update.id, $event)">Shared</label>
          </div><p class="text-sm leading-6 mt-4">
            {{ update.body }}
          </p><div v-if="update.metrics" class="panel-inset text-sm mt-4 p-4">
            {{ update.metrics }}
          </div>
        </article>
      </div><EmptyState v-else icon="i-carbon-report-data" title="No founder updates" description="Publish operating updates privately or share selected updates with program reviewers." />
    </template>

    <template v-else-if="activeTab === 'audit'">
      <section class="panel p-5 md:p-6">
        <h2 class="text-lg font-semibold">
          Applicant-visible audit history
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

    <BaseDialog :model-value="dialog === 'round'" title="Add fundraising round" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="createRound">
        <TextInput v-model="roundForm.title" label="Round title" /><div class="gap-4 grid sm:grid-cols-2">
          <SelectInput v-model="roundForm.instrument" label="Instrument" :options="['safe', 'convertible_note', 'preferred_equity', 'other'].map(value => ({ label: statusLabel(value), value }))" /><TextInput v-model="roundForm.targetAmount" label="Target amount" /><TextInput v-model="roundForm.minimumInvestment" label="Minimum investment" /><TextInput v-model="roundForm.valuationCap" label="Valuation cap" /><TextInput v-model="roundForm.discount" label="Discount" /><TextInput v-model="roundForm.openedAt" label="Open date" type="date" /><TextInput v-model="roundForm.targetCloseAt" label="Target close" type="date" />
        </div><TextareaInput v-model="roundForm.useOfFunds" label="Use of funds" :rows="4" /><BaseButton type="submit" :disabled="pending">
          Create round
        </BaseButton>
      </form>
    </BaseDialog>
    <BaseDialog :model-value="dialog === 'prospect'" title="Add private prospect" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="createProspect">
        <div class="panel-inset text-sm leading-6 p-4">
          This record remains applicant-only and is never included in program staff projections.
        </div><div class="gap-4 grid sm:grid-cols-2">
          <TextInput v-model="prospectForm.name" label="Contact name" /><TextInput v-model="prospectForm.firm" label="Firm" /><SelectInput v-model="prospectForm.kind" label="Prospect type" :options="['angel', 'fund', 'strategic', 'accelerator', 'other'].map(value => ({ label: statusLabel(value), value }))" /><SelectInput v-model="prospectForm.status" label="Status" :options="['researching', 'contact_planned', 'contacted', 'meeting', 'diligence', 'passed', 'committed', 'closed'].map(value => ({ label: statusLabel(value), value }))" /><TextInput v-model="prospectForm.email" label="Email" type="email" /><TextInput v-model="prospectForm.website" label="Website" type="url" /><TextInput v-model="prospectForm.expectedCheckSize" label="Expected check size" /><TextInput v-model="prospectForm.source" label="Source" /><TextInput v-model="prospectForm.nextStepAt" label="Next-step date" type="date" />
        </div><TextareaInput v-model="prospectForm.nextStep" label="Next step" :rows="3" /><TextareaInput v-model="prospectForm.notes" label="Private notes" :rows="4" /><BaseButton type="submit" :disabled="pending">
          Add prospect
        </BaseButton>
      </form>
    </BaseDialog>
    <BaseDialog :model-value="dialog === 'interaction'" title="Record private interaction" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="recordInteraction">
        <SelectInput v-model="interactionForm.type" label="Interaction type" :options="['note', 'email', 'call', 'meeting', 'data_room', 'term_sheet'].map(value => ({ label: statusLabel(value), value }))" /><TextInput v-model="interactionForm.occurredAt" label="Occurred at" type="datetime-local" /><TextareaInput v-model="interactionForm.summary" label="Summary" :rows="4" /><TextareaInput v-model="interactionForm.nextStep" label="Next step" :rows="3" /><BaseButton type="submit" :disabled="pending">
          Record interaction
        </BaseButton>
      </form>
    </BaseDialog>
    <BaseDialog :model-value="dialog === 'data-room'" title="Add data-room record" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="addDataRoomItem">
        <TextInput v-model="dataRoomForm.title" label="Title" /><SelectInput v-model="dataRoomForm.category" label="Category" :options="['pitch', 'corporate', 'financial', 'traction', 'team', 'product', 'legal', 'other'].map(value => ({ label: statusLabel(value), value }))" /><TextareaInput v-model="dataRoomForm.description" label="Description" :rows="4" /><TextInput v-model="dataRoomForm.externalUrl" label="Secure HTTPS link" type="url" helper="Use a secure link or upload a file below." /><label class="block"><span class="field-label">Private file</span><input type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" class="field-control" :disabled="uploadPending" @change="uploadDataRoomFile"><span v-if="uploadNotice" class="field-helper">{{ uploadNotice }}</span></label><label class="text-sm flex gap-3 items-start"><input v-model="dataRoomForm.shareWithProgram" type="checkbox" class="mt-1" :disabled="Boolean(dataRoomForm.fileUploadId)"><span>Share this record with program reviewers.</span></label><BaseButton type="submit" :disabled="pending || uploadPending">
          Add record
        </BaseButton>
      </form>
    </BaseDialog>
    <BaseDialog :model-value="dialog === 'withdraw'" title="Withdraw program application" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="withdrawApplication">
        <TextareaInput v-model="withdrawalReason" label="Withdrawal reason" :rows="5" /><BaseButton type="submit" variant="danger" :disabled="pending">
          Withdraw application
        </BaseButton>
      </form>
    </BaseDialog>
    <BaseDialog :model-value="dialog === 'request-response'" title="Respond to information request" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="respondToRequest">
        <TextareaInput v-model="responseForm.response" label="Response" :rows="7" /><BaseButton type="submit" :disabled="pending">
          Submit response
        </BaseButton>
      </form>
    </BaseDialog>
    <BaseDialog :model-value="dialog === 'diligence-response'" title="Update diligence response" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="respondToDiligence">
        <SelectInput v-model="responseForm.status" label="Response status" :options="[{ label: 'In progress', value: 'in_progress' }, { label: 'Submitted', value: 'submitted' }]" /><TextareaInput v-model="responseForm.response" label="Response" :rows="7" /><fieldset>
          <legend class="text-sm font-semibold">
            Program-shared evidence
          </legend><label v-for="item in workspace.dataRoomItems.filter(candidate => candidate.shareWithProgram)" :key="item.id" class="text-sm mt-3 flex gap-3 items-start"><input v-model="responseForm.evidenceDataRoomItemIds" type="checkbox" :value="item.id" class="mt-1"><span>{{ item.title }}</span></label>
        </fieldset><BaseButton type="submit" :disabled="pending">
          Save response
        </BaseButton>
      </form>
    </BaseDialog>
    <BaseDialog :model-value="dialog === 'update'" title="Publish founder update" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="publishUpdate">
        <TextInput v-model="updateForm.title" label="Update title" /><TextareaInput v-model="updateForm.body" label="Update" :rows="6" /><TextareaInput v-model="updateForm.metrics" label="Metrics" :rows="3" /><label class="text-sm flex gap-3 items-start"><input v-model="updateForm.shareWithProgram" type="checkbox" class="mt-1"><span>Share this update with program reviewers.</span></label><BaseButton type="submit" :disabled="pending">
          Publish update
        </BaseButton>
      </form>
    </BaseDialog>
  </div>

  <EmptyState v-else icon="i-carbon-warning-alt" title="Fundraising workspace unavailable" description="Return to your fundraising workspaces and choose an available record." />
</template>
