<script setup lang="ts">
import type { OrganizationApprovalRequest, OrganizationMemberRole, OrganizationMutation } from "~/shared/types/organizations"
import { formatDate } from "~/shared/utils/format"
import { canManageOrganization, canResolveOrganizationApprovals, formatOrganizationKind, formatOrganizationMemberRole, organizationMembershipFor } from "~/shared/utils/organizations"
import { getCurrentContractVersion, getCurrentProposalVersion } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Organization workspace")

const route = useRoute()
const router = useRouter()
const toastStore = useToastStore()
const { authStore, workspaceStore } = useCurrentMember()
const organizationStore = useOrganizationStore()
const investmentStore = useInvestmentWorkspaceStore()
const investmentEnabled = useFeatureFlag("featureInvestmentModule")
const pending = ref(false)
const dialog = ref<"" | "approval" | "decision" | "invite" | "link" | "policy" | "project" | "search" | "task" | "venture">("")
const approvalToResolve = ref<OrganizationApprovalRequest | null>(null)
const decisionNote = ref("")

const tabs = [
  { id: "overview", label: "Overview", icon: "i-carbon-dashboard" },
  { id: "portfolio", label: "Portfolio", icon: "i-carbon-portfolio" },
  { id: "projects", label: "Projects", icon: "i-carbon-task" },
  { id: "governance", label: "Governance", icon: "i-carbon-rule" },
  { id: "approvals", label: "Approvals", icon: "i-carbon-task-approved" },
  { id: "people", label: "People", icon: "i-carbon-user-multiple" },
  { id: "legal", label: "Legal", icon: "i-carbon-collaborate" },
  { id: "audit", label: "Audit", icon: "i-carbon-document-tasks" },
] as const

type TabId = typeof tabs[number]["id"]

const activeTab = computed<TabId>(() => {
  const requested = String(route.query.view || "overview")
  return tabs.some(tab => tab.id === requested) ? requested as TabId : "overview"
})
const organizationId = computed(() => String(route.params.id || ""))
const workspace = computed(() => organizationStore.snapshot.workspaces.find(item => item.organization.id === organizationId.value))
const currentUserId = computed(() => authStore.currentUser?.id || "")
const membership = computed(() => workspace.value ? organizationMembershipFor(workspace.value, currentUserId.value) : null)
const canManage = computed(() => workspace.value ? canManageOrganization(workspace.value, currentUserId.value) : false)
const canWork = computed(() => Boolean(membership.value && ["owner", "operator", "member"].includes(membership.value.role)))
const canReview = computed(() => workspace.value ? canResolveOrganizationApprovals(workspace.value, currentUserId.value) : false)
const canManagePolicy = computed(() => Boolean(membership.value && ["owner", "operator", "counsel"].includes(membership.value.role)))
const isOwner = computed(() => membership.value?.role === "owner")
const legalQueue = computed(() => organizationStore.snapshot.legalReviewQueue.filter(item => item.organizationId === organizationId.value))

const memberOptions = computed(() => workspace.value?.memberships.map(item => ({ label: item.displayName, value: item.userId })) || [])
const ventureOptions = computed(() => workspace.value?.ventures.filter(item => item.status !== "archived").map(item => ({ label: item.name, value: item.id })) || [])
const projectOptions = computed(() => workspace.value?.projects.filter(item => item.status !== "archived").map(item => ({ label: item.title, value: item.id })) || [])
const policyOptions = computed(() => workspace.value?.agreementPolicies.map(item => ({ label: item.name, value: item.id })) || [])
const savedSearchOptions = computed(() => workspaceStore.data.savedSearches.map(item => ({ label: item.label, value: item.id })))

const availableResources = computed(() => [
  ...workspaceStore.data.contracts.map((contract) => {
    const version = getCurrentContractVersion(workspaceStore.data, contract)
    return { id: contract.id, label: contract.title, type: "contract" as const, versionId: version?.id || null }
  }),
  ...workspaceStore.data.proposals.map((proposal) => {
    const version = getCurrentProposalVersion(workspaceStore.data, proposal)
    return { id: proposal.id, label: proposal.title, type: "proposal" as const, versionId: version?.id || null }
  }),
  ...workspaceStore.data.opportunities.filter(item => item.ownerUserId === currentUserId.value).map(item => ({
    id: item.id,
    label: item.startupName,
    type: "opportunity" as const,
    versionId: null,
  })),
  ...(investmentEnabled.value
    ? investmentStore.snapshot.workspaces.map(item => ({
        id: item.application.id,
        label: `Investment application · ${item.companyName}`,
        type: "investment_application" as const,
        versionId: null,
      }))
    : []),
  ...workspaceStore.data.investmentApplications.filter(item => !investmentStore.snapshot.workspaces.some(workspace => workspace.opportunityId === item.opportunityId)).map(item => ({
    id: item.id,
    label: `Investment application · ${workspaceStore.data.opportunities.find(opportunity => opportunity.id === item.opportunityId)?.startupName || item.id}`,
    type: "investment_application" as const,
    versionId: null,
  })),
])

const inviteForm = reactive({ displayName: "", email: "", role: "member" as Exclude<OrganizationMemberRole, "owner">, title: "" })
const ventureForm = reactive({ leadUserId: "", name: "", opportunityId: "", stage: "idea" as "idea" | "prototype" | "mvp" | "revenue" | "growth", summary: "" })
const projectForm = reactive({ description: "", dueAt: "", ownerUserId: "", title: "", ventureId: "" })
const taskForm = reactive({ assigneeUserId: "", dueAt: "", projectId: "", title: "" })
const decisionForm = reactive({ context: "", decision: "", ownerUserId: "", projectId: "", title: "", ventureId: "" })
const policyForm = reactive({
  allowOutsideCounsel: true,
  approvalRoles: ["owner", "operator", "reviewer", "counsel"] as OrganizationMemberRole[],
  description: "",
  isDefault: false,
  name: "",
  requiredClauses: "Roles and scope, Equity and vesting, IP assignment, Decision rights, Exit and termination",
  requiresInternalApproval: true,
  requiresLegalReview: false,
  separationOfDuties: true,
})
const approvalForm = reactive({ policyId: "", summary: "", target: "", title: "" })
const linkForm = reactive({ label: "", policyId: "", resource: "" })
const searchForm = reactive({ savedSearchId: "" })
const settingsForm = reactive({ allowOperatorInvites: true, dataRetentionDays: 365, seatLimit: 12 })

function errorMessage(error: unknown, fallback: string) {
  const payload = error as { data?: { message?: string }, statusMessage?: string }
  return payload.data?.message || payload.statusMessage || fallback
}

function toneForStatus(status: string) {
  if (["active", "approved", "completed", "done", "graduated"].includes(status))
    return "success" as const
  if (["blocked", "changes_requested", "rejected", "declined"].includes(status))
    return "warning" as const
  if (["pending", "in_progress", "under_review", "proposed"].includes(status))
    return "accent" as const
  return "neutral" as const
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ")
}

function toIsoDate(value: string) {
  return value ? new Date(`${value}T17:00:00`).toISOString() : null
}

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : ""
}

function open(action: typeof dialog.value) {
  dialog.value = action
}

async function selectTab(tab: TabId) {
  await router.replace({ query: { ...route.query, view: tab === "overview" ? undefined : tab } })
}

async function mutate(mutation: OrganizationMutation, successMessage: string) {
  if (!workspace.value)
    return null
  pending.value = true
  try {
    const result = await organizationStore.mutate(workspace.value, mutation)
    toastStore.push({ message: successMessage, title: "Organization updated", tone: "success" })
    return result
  }
  catch (error) {
    toastStore.push({ message: errorMessage(error, "The organization change could not be saved."), title: "Change not saved", tone: "danger" })
    return null
  }
  finally {
    pending.value = false
  }
}

async function inviteMember() {
  const result = await mutate({ action: "invite_member", ...inviteForm }, `Invitation prepared for ${inviteForm.email}.`)
  if (!result)
    return
  dialog.value = ""
  toastStore.push({
    message: result.delivery.delivered ? "The invitation email was delivered." : "Email is unavailable; the invitation will appear when that address signs in.",
    title: result.delivery.delivered ? "Invitation delivered" : "Invitation saved",
    tone: result.delivery.delivered ? "success" : "info",
  })
  Object.assign(inviteForm, { displayName: "", email: "", role: "member", title: "" })
}

async function createVenture() {
  if (!await mutate({
    action: "create_venture",
    leadUserId: ventureForm.leadUserId || null,
    name: ventureForm.name,
    opportunityId: ventureForm.opportunityId || null,
    stage: ventureForm.stage,
    summary: ventureForm.summary,
  }, `${ventureForm.name} was added to the portfolio.`)) {
    return
  }
  dialog.value = ""
  Object.assign(ventureForm, { leadUserId: "", name: "", opportunityId: "", stage: "idea", summary: "" })
}

async function createProject() {
  if (!await mutate({
    action: "create_project",
    description: projectForm.description,
    dueAt: toIsoDate(projectForm.dueAt),
    ownerUserId: projectForm.ownerUserId || null,
    title: projectForm.title,
    ventureId: projectForm.ventureId || null,
  }, `${projectForm.title} was added to the project board.`)) {
    return
  }
  dialog.value = ""
  Object.assign(projectForm, { description: "", dueAt: "", ownerUserId: "", title: "", ventureId: "" })
}

async function createTask() {
  if (!await mutate({
    action: "create_task",
    assigneeUserId: taskForm.assigneeUserId || null,
    dueAt: toIsoDate(taskForm.dueAt),
    projectId: taskForm.projectId,
    title: taskForm.title,
  }, `${taskForm.title} was added.`)) {
    return
  }
  dialog.value = ""
  Object.assign(taskForm, { assigneeUserId: "", dueAt: "", projectId: "", title: "" })
}

async function createDecision() {
  if (!await mutate({
    action: "create_decision",
    context: decisionForm.context,
    decision: decisionForm.decision,
    ownerUserId: decisionForm.ownerUserId,
    projectId: decisionForm.projectId || null,
    title: decisionForm.title,
    ventureId: decisionForm.ventureId || null,
  }, `${decisionForm.title} was added to the decision log.`)) {
    return
  }
  dialog.value = ""
  Object.assign(decisionForm, { context: "", decision: "", ownerUserId: "", projectId: "", title: "", ventureId: "" })
}

async function createPolicy() {
  if (!await mutate({
    action: "create_policy",
    allowOutsideCounsel: policyForm.allowOutsideCounsel,
    approvalRoles: policyForm.approvalRoles,
    description: policyForm.description,
    isDefault: policyForm.isDefault,
    name: policyForm.name,
    requiredClauses: policyForm.requiredClauses.split(",").map(item => item.trim()).filter(Boolean),
    requiresInternalApproval: policyForm.requiresInternalApproval,
    requiresLegalReview: policyForm.requiresLegalReview,
    separationOfDuties: policyForm.separationOfDuties,
  }, `${policyForm.name} is available for linked agreements.`)) {
    return
  }
  dialog.value = ""
  Object.assign(policyForm, { description: "", isDefault: false, name: "" })
}

async function requestApproval() {
  const target = availableResources.value.find(item => `${item.type}|${item.id}|${item.versionId || ""}` === approvalForm.target)
    || workspace.value?.projects.map(item => ({ id: item.id, label: item.title, type: "project" as const, versionId: null })).find(item => `project|${item.id}|` === approvalForm.target)
    || workspace.value?.ventures.map(item => ({ id: item.id, label: item.name, type: "venture" as const, versionId: null })).find(item => `venture|${item.id}|` === approvalForm.target)
  if (!target)
    return
  if (!await mutate({
    action: "request_approval",
    policyId: approvalForm.policyId || null,
    summary: approvalForm.summary,
    targetId: target.id,
    targetType: target.type,
    targetVersionId: target.versionId,
    title: approvalForm.title || target.label,
  }, `Approval was requested for ${approvalForm.title || target.label}.`)) {
    return
  }
  dialog.value = ""
  Object.assign(approvalForm, { policyId: "", summary: "", target: "", title: "" })
}

async function linkResource() {
  const target = availableResources.value.find(item => `${item.type}|${item.id}` === linkForm.resource)
  if (!target)
    return
  if (!await mutate({
    action: "link_resource",
    label: linkForm.label || target.label,
    policyId: linkForm.policyId || null,
    resourceId: target.id,
    resourceType: target.type,
  }, `${linkForm.label || target.label} is linked to this organization.`)) {
    return
  }
  dialog.value = ""
  Object.assign(linkForm, { label: "", policyId: "", resource: "" })
}

async function shareSearch() {
  const search = workspaceStore.data.savedSearches.find(item => item.id === searchForm.savedSearchId)
  if (!search)
    return
  if (!await mutate({
    action: "share_search",
    filters: search.filters,
    label: search.label,
    scope: search.scope,
    sourceSavedSearchId: search.id,
  }, `${search.label} is now shared with the organization.`)) {
    return
  }
  dialog.value = ""
  searchForm.savedSearchId = ""
}

async function updateTask(taskId: string, event: Event) {
  if (!workspace.value)
    return
  const task = workspace.value.tasks.find(item => item.id === taskId)
  if (!task)
    return
  await mutate({
    action: "update_task",
    assigneeUserId: task.assigneeUserId,
    dueAt: task.dueAt,
    status: (event.target as HTMLSelectElement).value as "todo" | "in_progress" | "blocked" | "done",
    taskId: task.id,
    title: task.title,
  }, `${task.title} was updated.`)
}

async function updateProject(projectId: string, event: Event) {
  if (!workspace.value)
    return
  const project = workspace.value.projects.find(item => item.id === projectId)
  if (!project)
    return
  await mutate({
    action: "update_project",
    description: project.description,
    dueAt: project.dueAt,
    ownerUserId: project.ownerUserId,
    projectId: project.id,
    status: (event.target as HTMLSelectElement).value as "planned" | "active" | "blocked" | "completed" | "archived",
    title: project.title,
  }, `${project.title} was updated.`)
}

async function updateVenture(ventureId: string, event: Event) {
  if (!workspace.value)
    return
  const venture = workspace.value.ventures.find(item => item.id === ventureId)
  if (!venture)
    return
  await mutate({
    action: "update_venture",
    leadUserId: venture.leadUserId,
    stage: venture.stage,
    status: (event.target as HTMLSelectElement).value as "incubating" | "active" | "paused" | "graduated" | "archived",
    summary: venture.summary,
    ventureId: venture.id,
  }, `${venture.name} was updated.`)
}

async function updateMemberRole(membershipId: string, event: Event) {
  if (!workspace.value)
    return
  const member = workspace.value.memberships.find(item => item.id === membershipId)
  if (!member || member.role === "owner")
    return
  await mutate({
    action: "update_member",
    membershipId,
    role: (event.target as HTMLSelectElement).value as Exclude<OrganizationMemberRole, "owner">,
    title: member.title,
  }, `${member.displayName}'s role was updated.`)
}

async function removeMember(membershipId: string) {
  const member = workspace.value?.memberships.find(item => item.id === membershipId)
  if (member)
    await mutate({ action: "remove_member", membershipId }, `${member.displayName} was removed from the organization.`)
}

async function transferOwnership(membershipId: string) {
  const member = workspace.value?.memberships.find(item => item.id === membershipId)
  if (member)
    await mutate({ action: "transfer_ownership", membershipId }, `${member.displayName} is now the organization owner.`)
}

function openApprovalDecision(approval: OrganizationApprovalRequest) {
  approvalToResolve.value = approval
  decisionNote.value = ""
}

async function resolveApproval(status: "approved" | "changes_requested" | "rejected") {
  if (!approvalToResolve.value)
    return
  if (await mutate({
    action: "resolve_approval",
    approvalId: approvalToResolve.value.id,
    decisionNote: decisionNote.value,
    status,
  }, `${approvalToResolve.value.title} was marked ${statusLabel(status)}.`)) {
    approvalToResolve.value = null
    decisionNote.value = ""
  }
}

async function resolveDecision(decisionId: string, status: "approved" | "superseded") {
  const item = workspace.value?.decisions.find(decision => decision.id === decisionId)
  if (item)
    await mutate({ action: "resolve_decision", decision: item.decision, decisionId, status }, `${item.title} was marked ${status}.`)
}

async function revokeInvitation(invitationId: string) {
  await mutate({ action: "revoke_invitation", invitationId }, "The invitation was revoked.")
}

async function saveSettings() {
  await mutate({ action: "update_settings", ...settingsForm }, "Seat and retention controls were updated.")
}

watch(workspace, (current) => {
  if (!current)
    return
  settingsForm.allowOperatorInvites = current.organization.allowOperatorInvites
  settingsForm.dataRetentionDays = current.organization.dataRetentionDays || 365
  settingsForm.seatLimit = current.organization.seatLimit
}, { immediate: true })

onMounted(async () => {
  await Promise.all([
    organizationStore.load(true),
    investmentEnabled.value ? investmentStore.load(true) : Promise.resolve(),
  ])
})
</script>

<template>
  <div v-if="workspace && membership" class="gap-6 grid">
    <PageIntro
      :eyebrow="formatOrganizationKind(workspace.organization.kind)"
      :title="workspace.organization.name"
      :description="workspace.organization.description"
    >
      <template #actions>
        <BaseBadge :tone="workspace.organization.status === 'active' ? 'success' : 'neutral'">
          {{ workspace.organization.status }}
        </BaseBadge>
        <BaseBadge tone="accent">
          {{ formatOrganizationMemberRole(membership.role) }}
        </BaseBadge>
        <BaseButton variant="secondary" to="/app/studio">
          All organizations
        </BaseButton>
      </template>
    </PageIntro>

    <div class="overflow-x-auto">
      <div class="p-1 border border-[var(--line)] rounded-xl bg-[var(--panel-inset)] inline-flex gap-1 min-w-max" role="tablist" aria-label="Organization workspace views">
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
        <MetricTile label="Seats" :value="`${workspace.memberships.length}/${workspace.organization.seatLimit}`" context="Active members and seat limit" />
        <MetricTile label="Ventures" :value="workspace.ventures.filter(item => item.status !== 'archived').length" context="Active portfolio records" />
        <MetricTile label="Open tasks" :value="workspace.tasks.filter(item => item.status !== 'done').length" context="Across organization projects" />
        <MetricTile label="Pending approvals" :value="workspace.approvalRequests.filter(item => item.status === 'pending').length" context="Waiting on internal review" />
      </div>

      <div class="gap-6 grid xl:grid-cols-2">
        <section class="panel p-5 md:p-6">
          <div class="flex flex-wrap gap-3 items-center justify-between">
            <h2 class="text-lg font-semibold">
              Linked workspace records
            </h2>
            <BaseButton v-if="canManage" size="sm" variant="secondary" @click="open('link')">
              <span class="i-carbon-link" />
              Link record
            </BaseButton>
          </div>
          <div v-if="workspace.resourceLinks.length" class="surface-row-list mt-4">
            <div v-for="resource in workspace.resourceLinks" :key="resource.id" class="surface-row flex gap-4 items-start justify-between">
              <div>
                <p class="font-semibold">
                  {{ resource.label }}
                </p>
                <p class="muted text-sm mt-1">
                  {{ statusLabel(resource.resourceType) }} · {{ workspace.agreementPolicies.find(policy => policy.id === resource.policyId)?.name || 'No policy' }}
                </p>
              </div>
              <BaseButton v-if="canManage" size="sm" variant="ghost" aria-label="Unlink record" @click="mutate({ action: 'unlink_resource', resourceLinkId: resource.id }, `${resource.label} was unlinked.`)">
                <span class="i-carbon-unlink" />
              </BaseButton>
            </div>
          </div>
          <p v-else class="muted text-sm leading-6 mt-4">
            No relationships, proposals, agreements, opportunities, or investment applications are linked.
          </p>
        </section>

        <section class="panel p-5 md:p-6">
          <div class="flex flex-wrap gap-3 items-center justify-between">
            <h2 class="text-lg font-semibold">
              Shared searches
            </h2>
            <BaseButton v-if="canWork && savedSearchOptions.length" size="sm" variant="secondary" @click="open('search')">
              <span class="i-carbon-share" />
              Share search
            </BaseButton>
          </div>
          <div v-if="workspace.sharedSearches.length" class="surface-row-list mt-4">
            <div v-for="search in workspace.sharedSearches" :key="search.id" class="surface-row flex gap-4 items-start justify-between">
              <div>
                <p class="font-semibold">
                  {{ search.label }}
                </p>
                <p class="muted text-sm mt-1">
                  {{ search.scope }} · {{ search.filters.query || 'Structured filters' }}
                </p>
              </div>
              <BaseButton size="sm" variant="ghost" :to="`/app/discover?scope=${search.scope}`" aria-label="Open shared search">
                <span class="i-carbon-launch" />
              </BaseButton>
            </div>
          </div>
          <p v-else class="muted text-sm leading-6 mt-4">
            No member search has been shared with this organization.
          </p>
        </section>
      </div>
    </template>

    <section v-else-if="activeTab === 'portfolio'" class="panel p-5 md:p-6">
      <div class="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Venture portfolio
          </h2>
          <p class="muted text-sm mt-2">
            {{ workspace.ventures.length }} portfolio records
          </p>
        </div>
        <BaseButton v-if="canManage" size="sm" @click="open('venture')">
          <span class="i-carbon-add" />
          Add venture
        </BaseButton>
      </div>
      <div v-if="workspace.ventures.length" class="surface-row-list mt-5">
        <article v-for="venture in workspace.ventures" :key="venture.id" class="surface-row">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div class="flex flex-wrap gap-2 items-center">
                <h3 class="font-semibold">
                  {{ venture.name }}
                </h3>
                <BaseBadge :tone="toneForStatus(venture.status)">
                  {{ statusLabel(venture.status) }}
                </BaseBadge>
              </div>
              <p class="muted text-sm leading-6 mt-2">
                {{ venture.summary }}
              </p>
              <p class="muted text-xs mt-3">
                {{ venture.stage }} · Lead {{ workspace.memberships.find(item => item.userId === venture.leadUserId)?.displayName || 'Unassigned' }}
              </p>
            </div>
            <select v-if="canManage" class="field-control w-full md:w-44" :value="venture.status" :aria-label="`Status for ${venture.name}`" @change="updateVenture(venture.id, $event)">
              <option value="incubating">
                Incubating
              </option><option value="active">
                Active
              </option><option value="paused">
                Paused
              </option><option value="graduated">
                Graduated
              </option><option value="archived">
                Archived
              </option>
            </select>
          </div>
        </article>
      </div>
      <EmptyState v-else class="mt-5" icon="i-carbon-portfolio" title="No portfolio ventures" description="Add the first venture to connect operating work and governance." />
    </section>

    <section v-else-if="activeTab === 'projects'" class="panel p-5 md:p-6">
      <div class="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Projects and tasks
          </h2>
          <p class="muted text-sm mt-2">
            {{ workspace.projects.length }} projects · {{ workspace.tasks.filter(item => item.status !== 'done').length }} open tasks
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <BaseButton v-if="canWork" size="sm" variant="secondary" @click="open('task')">
            <span class="i-carbon-task-add" />Add task
          </BaseButton>
          <BaseButton v-if="canWork" size="sm" @click="open('project')">
            <span class="i-carbon-add" />New project
          </BaseButton>
        </div>
      </div>
      <div v-if="workspace.projects.length" class="surface-row-list mt-5">
        <article v-for="project in workspace.projects" :key="project.id" class="surface-row">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div class="flex flex-wrap gap-2 items-center">
                <h3 class="font-semibold">
                  {{ project.title }}
                </h3><BaseBadge :tone="toneForStatus(project.status)">
                  {{ statusLabel(project.status) }}
                </BaseBadge>
              </div>
              <p class="muted text-sm leading-6 mt-2">
                {{ project.description }}
              </p>
              <p class="muted text-xs mt-3">
                Owner {{ workspace.memberships.find(item => item.userId === project.ownerUserId)?.displayName || 'Unassigned' }}<template v-if="project.dueAt">
                  · Due {{ formatDate(project.dueAt) }}
                </template>
              </p>
            </div>
            <select v-if="canWork" class="field-control w-full md:w-44" :value="project.status" :aria-label="`Status for ${project.title}`" @change="updateProject(project.id, $event)">
              <option value="planned">
                Planned
              </option><option value="active">
                Active
              </option><option value="blocked">
                Blocked
              </option><option value="completed">
                Completed
              </option><option value="archived">
                Archived
              </option>
            </select>
          </div>
          <div class="surface-row-list mt-4 pt-4 border-t border-[var(--line)]">
            <div v-for="task in workspace.tasks.filter(item => item.projectId === project.id)" :key="task.id" class="surface-row flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-sm font-semibold">
                  {{ task.title }}
                </p><p class="muted text-xs mt-1">
                  {{ workspace.memberships.find(item => item.userId === task.assigneeUserId)?.displayName || 'Unassigned' }}<template v-if="task.dueAt">
                    · {{ dateInputValue(task.dueAt) }}
                  </template>
                </p>
              </div>
              <select class="field-control w-full sm:w-40" :value="task.status" :aria-label="`Status for ${task.title}`" @change="updateTask(task.id, $event)">
                <option value="todo">
                  To do
                </option><option value="in_progress">
                  In progress
                </option><option value="blocked">
                  Blocked
                </option><option value="done">
                  Done
                </option>
              </select>
            </div>
            <p v-if="!workspace.tasks.some(item => item.projectId === project.id)" class="muted text-sm">
              No tasks in this project.
            </p>
          </div>
        </article>
      </div>
      <EmptyState v-else class="mt-5" icon="i-carbon-task" title="No projects" description="Create a project to assign work and track delivery." />
    </section>

    <template v-else-if="activeTab === 'governance'">
      <section class="panel p-5 md:p-6">
        <div class="flex flex-wrap gap-3 items-center justify-between">
          <h2 class="text-lg font-semibold">
            Decision log
          </h2><BaseButton v-if="canReview" size="sm" @click="open('decision')">
            <span class="i-carbon-add" />Propose decision
          </BaseButton>
        </div>
        <div v-if="workspace.decisions.length" class="surface-row-list mt-5">
          <article v-for="item in workspace.decisions" :key="item.id" class="surface-row">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div>
                <h3 class="font-semibold">
                  {{ item.title }}
                </h3><p class="muted text-sm leading-6 mt-2">
                  {{ item.context }}
                </p>
              </div><BaseBadge :tone="toneForStatus(item.status)">
                {{ item.status }}
              </BaseBadge>
            </div>
            <p class="text-sm leading-6 mt-3">
              {{ item.decision }}
            </p>
            <div v-if="item.status === 'proposed' && canReview" class="mt-4 flex flex-wrap gap-2">
              <BaseButton size="sm" @click="resolveDecision(item.id, 'approved')">
                Approve
              </BaseButton><BaseButton size="sm" variant="ghost" @click="resolveDecision(item.id, 'superseded')">
                Supersede
              </BaseButton>
            </div>
          </article>
        </div>
        <p v-else class="muted text-sm mt-5">
          No governance decisions have been recorded.
        </p>
      </section>

      <section class="panel p-5 md:p-6">
        <div class="flex flex-wrap gap-3 items-center justify-between">
          <h2 class="text-lg font-semibold">
            Agreement policies
          </h2><BaseButton v-if="canManagePolicy" size="sm" @click="open('policy')">
            <span class="i-carbon-add" />New policy
          </BaseButton>
        </div>
        <div class="surface-row-list mt-5">
          <article v-for="policy in workspace.agreementPolicies" :key="policy.id" class="surface-row">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div>
                <div class="flex flex-wrap gap-2 items-center">
                  <h3 class="font-semibold">
                    {{ policy.name }}
                  </h3><BaseBadge v-if="policy.isDefault" tone="accent">
                    Default
                  </BaseBadge>
                </div><p class="muted text-sm leading-6 mt-2">
                  {{ policy.description }}
                </p>
              </div><BaseBadge :tone="policy.requiresLegalReview ? 'warning' : 'neutral'">
                {{ policy.requiresLegalReview ? 'Legal review required' : 'Legal review optional' }}
              </BaseBadge>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <BaseBadge v-for="clause in policy.requiredClauses" :key="clause" tone="neutral">
                {{ clause }}
              </BaseBadge>
            </div>
            <p class="muted text-xs leading-5 mt-4">
              Internal approval {{ policy.requiresInternalApproval ? 'required' : 'optional' }} · {{ policy.separationOfDuties ? 'Separate approver required' : 'Requester may approve' }} · Outside counsel {{ policy.allowOutsideCounsel ? 'allowed' : 'restricted' }}
            </p>
          </article>
        </div>
      </section>
    </template>

    <section v-else-if="activeTab === 'approvals'" class="panel p-5 md:p-6">
      <div class="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Approval queue
          </h2><p class="muted text-sm mt-2">
            Version-bound internal review records
          </p>
        </div><BaseButton size="sm" @click="open('approval')">
          <span class="i-carbon-add" />Request approval
        </BaseButton>
      </div>
      <div v-if="workspace.approvalRequests.length" class="surface-row-list mt-5">
        <article v-for="approval in workspace.approvalRequests" :key="approval.id" class="surface-row">
          <div class="flex flex-wrap gap-3 items-start justify-between">
            <div>
              <h3 class="font-semibold">
                {{ approval.title }}
              </h3><p class="muted text-sm mt-1">
                {{ statusLabel(approval.targetType) }}<template v-if="approval.targetVersionId">
                  · version-bound
                </template>
              </p>
            </div><BaseBadge :tone="toneForStatus(approval.status)">
              {{ statusLabel(approval.status) }}
            </BaseBadge>
          </div>
          <p class="muted text-sm leading-6 mt-3">
            {{ approval.summary }}
          </p>
          <div v-if="approval.decisionNote" class="text-sm leading-6 mt-3">
            <span class="font-semibold">Decision:</span> {{ approval.decisionNote }}
          </div>
          <div v-if="approval.status === 'pending'" class="mt-4 flex flex-wrap gap-2">
            <BaseButton v-if="canReview" size="sm" @click="openApprovalDecision(approval)">
              Review
            </BaseButton><BaseButton v-if="approval.requestedByUserId === currentUserId || canManage" size="sm" variant="ghost" @click="mutate({ action: 'cancel_approval', approvalId: approval.id }, `${approval.title} was canceled.`)">
              Cancel
            </BaseButton>
          </div>
        </article>
      </div>
      <EmptyState v-else class="mt-5" icon="i-carbon-task-approved" title="No approval records" description="Request an approval for a proposal, agreement, venture, project, or investment application." />
    </section>

    <template v-else-if="activeTab === 'people'">
      <section class="panel p-5 md:p-6">
        <div class="flex flex-wrap gap-3 items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold">
              Members and seats
            </h2><p class="muted text-sm mt-2">
              {{ workspace.memberships.length }} of {{ workspace.organization.seatLimit }} active seats
            </p>
          </div><BaseButton v-if="canManage" size="sm" @click="open('invite')">
            <span class="i-carbon-user-follow" />Invite member
          </BaseButton>
        </div>
        <div class="surface-row-list mt-5">
          <div v-for="member in workspace.memberships" :key="member.id" class="surface-row flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p class="font-semibold">
                {{ member.displayName }}
              </p><p class="muted text-sm mt-1">
                {{ member.title }} · {{ member.email }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2 items-center">
              <BaseBadge v-if="member.role === 'owner'" tone="accent">
                Owner
              </BaseBadge>
              <select v-else-if="isOwner" class="field-control w-40" :value="member.role" :aria-label="`Role for ${member.displayName}`" @change="updateMemberRole(member.id, $event)">
                <option value="operator">
                  Operator
                </option><option value="member">
                  Member
                </option><option value="reviewer">
                  Reviewer
                </option><option value="billing">
                  Billing
                </option><option value="counsel">
                  Counsel
                </option>
              </select>
              <BaseBadge v-else tone="neutral">
                {{ formatOrganizationMemberRole(member.role) }}
              </BaseBadge>
              <BaseButton v-if="isOwner && member.role !== 'owner'" size="sm" variant="ghost" aria-label="Transfer ownership" @click="transferOwnership(member.id)">
                <span class="i-carbon-user-role" />
              </BaseButton>
              <BaseButton v-if="isOwner && member.role !== 'owner'" size="sm" variant="danger" aria-label="Remove member" @click="removeMember(member.id)">
                <span class="i-carbon-trash-can" />
              </BaseButton>
            </div>
          </div>
        </div>
        <div v-if="workspace.invitations.length" class="mt-6">
          <h3 class="font-semibold">
            Pending invitations
          </h3><div class="surface-row-list mt-3">
            <div v-for="invitation in workspace.invitations.filter(item => item.status === 'pending')" :key="invitation.id" class="surface-row flex gap-3 items-center justify-between">
              <div>
                <p class="text-sm font-semibold">
                  {{ invitation.displayName }}
                </p><p class="muted text-xs mt-1">
                  {{ invitation.email }} · {{ invitation.role }}
                </p>
              </div><BaseButton v-if="canManage" size="sm" variant="ghost" @click="revokeInvitation(invitation.id)">
                Revoke
              </BaseButton>
            </div>
          </div>
        </div>
      </section>

      <section v-if="isOwner" class="panel p-5 md:p-6">
        <h2 class="text-lg font-semibold">
          Seat and retention controls
        </h2>
        <form class="mt-5 gap-4 grid md:grid-cols-2" @submit.prevent="saveSettings">
          <label class="block"><span class="field-label"><span>Seat limit</span></span><input v-model.number="settingsForm.seatLimit" type="number" min="2" max="100" class="field-control"></label>
          <label class="block"><span class="field-label"><span>Audit retention days</span></span><input v-model.number="settingsForm.dataRetentionDays" type="number" min="30" max="3650" class="field-control"></label>
          <label class="flex gap-3 items-start md:col-span-2"><input v-model="settingsForm.allowOperatorInvites" type="checkbox" class="mt-1"><span><span class="font-semibold">Operators can invite members</span><span class="muted text-sm mt-1 block">Owners still control roles, removals, billing ownership, and ownership transfer.</span></span></label>
          <div class="flex justify-end md:col-span-2">
            <BaseButton type="submit" :disabled="pending">
              Save controls
            </BaseButton>
          </div>
        </form>
      </section>
    </template>

    <section v-else-if="activeTab === 'legal'" class="panel p-5 md:p-6">
      <div class="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Counsel queue
          </h2><p class="muted text-sm mt-2">
            Review invitations addressed to active reviewer or counsel seats
          </p>
        </div><BaseButton size="sm" variant="secondary" to="/app/legal">
          Agreement legal review
        </BaseButton>
      </div>
      <div v-if="legalQueue.length" class="surface-row-list mt-5">
        <article v-for="review in legalQueue" :key="review.id" class="surface-row flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div class="flex flex-wrap gap-2 items-center">
              <p class="font-semibold">
                {{ review.reviewerName }}
              </p><BaseBadge :tone="toneForStatus(review.status)">
                {{ statusLabel(review.status) }}
              </BaseBadge>
            </div><p class="muted text-sm mt-2">
              {{ review.reviewerOrganization }} · Expires {{ formatDate(review.expiresAt) }}
            </p>
          </div><BaseButton :href="review.reviewUrl">
            Open review
          </BaseButton>
        </article>
      </div>
      <EmptyState v-else class="mt-5" icon="i-carbon-collaborate" title="No counsel reviews assigned" description="Version-bound agreement reviews addressed to this seat will appear here." />
    </section>

    <section v-else-if="activeTab === 'audit'" class="panel p-5 md:p-6">
      <div class="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Organization audit history
          </h2><p class="muted text-sm mt-2">
            {{ workspace.organization.dataRetentionDays || 'Restricted' }}-day configured retention
          </p>
        </div><BaseBadge tone="neutral">
          {{ workspace.auditEvents.length }} events
        </BaseBadge>
      </div>
      <div v-if="workspace.auditEvents.length" class="surface-row-list mt-5">
        <div v-for="event in workspace.auditEvents" :key="event.id" class="surface-row">
          <div class="flex flex-wrap gap-3 items-start justify-between">
            <p class="font-semibold">
              {{ event.summary }}
            </p><p class="muted text-xs">
              {{ formatDate(event.createdAt) }}
            </p>
          </div><p class="muted text-xs mt-2">
            {{ event.action }} · {{ event.targetType }}
          </p>
        </div>
      </div>
      <p v-else class="muted text-sm mt-5">
        No audit events are visible to this role.
      </p>
    </section>

    <BaseDialog :model-value="dialog === 'invite'" title="Invite organization member" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="inviteMember">
        <TextInput v-model="inviteForm.displayName" label="Name" /><TextInput v-model="inviteForm.email" label="Email" /><TextInput v-model="inviteForm.title" label="Organization title" /><SelectInput v-model="inviteForm.role" label="Seat role" :options="[{ label: 'Operator', value: 'operator' }, { label: 'Member', value: 'member' }, { label: 'Reviewer', value: 'reviewer' }, { label: 'Billing', value: 'billing' }, { label: 'Counsel', value: 'counsel' }]" /><div class="flex justify-end">
          <BaseButton type="submit" :disabled="pending">
            Invite member
          </BaseButton>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog :model-value="dialog === 'venture'" title="Add portfolio venture" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="createVenture">
        <TextInput v-model="ventureForm.name" label="Venture name" /><TextareaInput v-model="ventureForm.summary" label="Summary" :rows="4" /><SelectInput v-model="ventureForm.stage" label="Stage" :options="[{ label: 'Idea', value: 'idea' }, { label: 'Prototype', value: 'prototype' }, { label: 'MVP', value: 'mvp' }, { label: 'Revenue', value: 'revenue' }, { label: 'Growth', value: 'growth' }]" /><SelectInput v-model="ventureForm.leadUserId" label="Venture lead" :options="memberOptions" /><SelectInput v-model="ventureForm.opportunityId" label="Linked opportunity" :options="workspaceStore.data.opportunities.filter(item => item.ownerUserId === currentUserId).map(item => ({ label: item.startupName, value: item.id }))" /><div class="flex justify-end">
          <BaseButton type="submit" :disabled="pending">
            Add venture
          </BaseButton>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog :model-value="dialog === 'project'" title="Create organization project" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="createProject">
        <TextInput v-model="projectForm.title" label="Project title" /><TextareaInput v-model="projectForm.description" label="Description" :rows="4" /><SelectInput v-model="projectForm.ventureId" label="Portfolio venture" :options="ventureOptions" /><SelectInput v-model="projectForm.ownerUserId" label="Project owner" :options="memberOptions" /><TextInput v-model="projectForm.dueAt" type="date" label="Due date" /><div class="flex justify-end">
          <BaseButton type="submit" :disabled="pending">
            Create project
          </BaseButton>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog :model-value="dialog === 'task'" title="Add project task" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="createTask">
        <SelectInput v-model="taskForm.projectId" label="Project" :options="projectOptions" /><TextInput v-model="taskForm.title" label="Task" /><SelectInput v-model="taskForm.assigneeUserId" label="Assignee" :options="memberOptions" /><TextInput v-model="taskForm.dueAt" type="date" label="Due date" /><div class="flex justify-end">
          <BaseButton type="submit" :disabled="pending">
            Add task
          </BaseButton>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog :model-value="dialog === 'decision'" title="Propose governance decision" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="createDecision">
        <TextInput v-model="decisionForm.title" label="Decision title" /><TextareaInput v-model="decisionForm.context" label="Context" :rows="3" /><TextareaInput v-model="decisionForm.decision" label="Proposed decision" :rows="4" /><SelectInput v-model="decisionForm.ownerUserId" label="Decision owner" :options="memberOptions" /><SelectInput v-model="decisionForm.ventureId" label="Venture" :options="ventureOptions" /><SelectInput v-model="decisionForm.projectId" label="Project" :options="projectOptions" /><div class="flex justify-end">
          <BaseButton type="submit" :disabled="pending">
            Propose decision
          </BaseButton>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog :model-value="dialog === 'policy'" title="Create agreement policy" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="createPolicy">
        <TextInput v-model="policyForm.name" label="Policy name" /><TextareaInput v-model="policyForm.description" label="Policy purpose" :rows="3" /><TextareaInput v-model="policyForm.requiredClauses" label="Required clauses" helper="Separate clause names with commas." :rows="3" /><div class="gap-3 grid sm:grid-cols-2">
          <label class="flex gap-3 items-start"><input v-model="policyForm.requiresInternalApproval" type="checkbox" class="mt-1"><span class="text-sm font-semibold">Require internal approval</span></label><label class="flex gap-3 items-start"><input v-model="policyForm.separationOfDuties" type="checkbox" class="mt-1"><span class="text-sm font-semibold">Require a separate approver</span></label><label class="flex gap-3 items-start"><input v-model="policyForm.requiresLegalReview" type="checkbox" class="mt-1"><span class="text-sm font-semibold">Require approved legal review</span></label><label class="flex gap-3 items-start"><input v-model="policyForm.allowOutsideCounsel" type="checkbox" class="mt-1"><span class="text-sm font-semibold">Allow outside counsel</span></label><label class="flex gap-3 items-start"><input v-model="policyForm.isDefault" type="checkbox" class="mt-1"><span class="text-sm font-semibold">Make default policy</span></label>
        </div><fieldset>
          <legend class="field-label">
            Eligible approval roles
          </legend><div class="flex flex-wrap gap-4">
            <label v-for="role in ['owner', 'operator', 'reviewer', 'counsel']" :key="role" class="text-sm flex gap-2 items-center"><input v-model="policyForm.approvalRoles" type="checkbox" :value="role">{{ formatOrganizationMemberRole(role as OrganizationMemberRole) }}</label>
          </div>
        </fieldset><div class="flex justify-end">
          <BaseButton type="submit" :disabled="pending">
            Create policy
          </BaseButton>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog :model-value="dialog === 'approval'" title="Request internal approval" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="requestApproval">
        <SelectInput v-model="approvalForm.target" label="Approval target" :options="[...availableResources.map(item => ({ label: `${statusLabel(item.type)} · ${item.label}`, value: `${item.type}|${item.id}|${item.versionId || ''}` })), ...workspace.projects.map(item => ({ label: `project · ${item.title}`, value: `project|${item.id}|` })), ...workspace.ventures.map(item => ({ label: `venture · ${item.name}`, value: `venture|${item.id}|` }))]" /><TextInput v-model="approvalForm.title" label="Approval title" /><SelectInput v-model="approvalForm.policyId" label="Agreement policy" :options="policyOptions" /><TextareaInput v-model="approvalForm.summary" label="Review summary" :rows="4" /><div class="flex justify-end">
          <BaseButton type="submit" :disabled="pending">
            Request approval
          </BaseButton>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog :model-value="dialog === 'link'" title="Link workspace record" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="linkResource">
        <SelectInput v-model="linkForm.resource" label="Record" :options="availableResources.map(item => ({ label: `${statusLabel(item.type)} · ${item.label}`, value: `${item.type}|${item.id}` }))" /><TextInput v-model="linkForm.label" label="Organization label" /><SelectInput v-model="linkForm.policyId" label="Agreement policy" :options="policyOptions" /><div class="flex justify-end">
          <BaseButton type="submit" :disabled="pending">
            Link record
          </BaseButton>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog :model-value="dialog === 'search'" title="Share saved search" @update:model-value="dialog = ''">
      <form class="gap-4 grid" @submit.prevent="shareSearch">
        <SelectInput v-model="searchForm.savedSearchId" label="Saved search" :options="savedSearchOptions" /><div class="flex justify-end">
          <BaseButton type="submit" :disabled="pending">
            Share search
          </BaseButton>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog :model-value="Boolean(approvalToResolve)" title="Resolve approval" @update:model-value="approvalToResolve = null">
      <div v-if="approvalToResolve" class="gap-4 grid">
        <div>
          <p class="font-semibold">
            {{ approvalToResolve.title }}
          </p><p class="muted text-sm leading-6 mt-2">
            {{ approvalToResolve.summary }}
          </p>
        </div><TextareaInput v-model="decisionNote" label="Decision note" :rows="4" /><div class="flex flex-wrap gap-2 justify-end">
          <BaseButton variant="danger" :disabled="pending" @click="resolveApproval('rejected')">
            Reject
          </BaseButton><BaseButton variant="secondary" :disabled="pending" @click="resolveApproval('changes_requested')">
            Request changes
          </BaseButton><BaseButton :disabled="pending" @click="resolveApproval('approved')">
            Approve
          </BaseButton>
        </div>
      </div>
    </BaseDialog>
  </div>

  <div v-else-if="organizationStore.loading" class="panel muted text-sm p-8" role="status">
    Loading organization workspace...
  </div>
  <EmptyState v-else icon="i-carbon-warning-alt" title="Organization unavailable" description="This workspace does not exist, or your account no longer has access.">
    <BaseButton to="/app/studio">
      Back to organizations
    </BaseButton>
  </EmptyState>
</template>
