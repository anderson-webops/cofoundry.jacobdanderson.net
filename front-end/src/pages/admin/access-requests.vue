<script setup lang="ts">
import type { AccessRequest, AccessRequestStatus } from "~/shared/types/domain"
import { formatDate, formatRelativeDate } from "~/shared/utils/format"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin access requests")

interface AccessRequestResponse {
  mode: string
  requests: AccessRequest[]
  warning: string | null
}

interface InviteResponse {
  inviteToken: string
  inviteUrl: string
  request: AccessRequest
}

const toastStore = useToastStore()
const { data, pending, refresh } = await useAsyncData("admin-access-requests", () => $fetch<AccessRequestResponse>("/api/admin/access-requests"))

const filters = reactive({
  query: "",
  status: "all",
})
const actionNotes = reactive<Record<string, string>>({})
const pendingAction = ref("")
const lastInviteByRequestId = reactive<Record<string, InviteResponse>>({})

const statusOptions = [
  { label: "All requests", value: "all" },
  { label: "Open", value: "open" },
  { label: "Approved", value: "approved" },
  { label: "Invited", value: "invited" },
  { label: "Denied", value: "denied" },
]

const requests = computed(() => data.value?.requests || [])
const filteredRequests = computed(() => {
  const query = filters.query.trim().toLowerCase()

  return requests.value.filter((request) => {
    const matchesStatus = filters.status === "all" || request.status === filters.status
    const matchesQuery = !query || [
      request.name,
      request.email,
      request.company,
      request.role,
      request.companyStage,
      request.timeline,
      request.useCase,
    ].some(value => value?.toLowerCase().includes(query))

    return matchesStatus && matchesQuery
  })
})

const counts = computed(() => ({
  approved: requests.value.filter(request => request.status === "approved").length,
  denied: requests.value.filter(request => request.status === "denied").length,
  invited: requests.value.filter(request => request.status === "invited").length,
  open: requests.value.filter(request => request.status === "open").length,
}))

function statusTone(status: AccessRequestStatus) {
  return {
    approved: "success" as const,
    denied: "danger" as const,
    invited: "accent" as const,
    open: "warning" as const,
  }[status]
}

function formatChoice(value: string) {
  return value.replaceAll("_", " ")
}

function isAccountHelpRequest(request: AccessRequest) {
  return request.source === "auth-recovery"
}

function defaultNote(request: AccessRequest, action: AccessRequestStatus | "invite") {
  if (isAccountHelpRequest(request)) {
    if (action === "invite")
      return `Issued replacement workspace invite to ${request.email} after verifying the account-help request.`

    if (action === "approved")
      return `Approved account-help request from ${request.email} after verifying ownership.`

    if (action === "denied")
      return `Denied account-help request from ${request.email} after ownership review.`

    return `Reopened account-help request from ${request.email} for verification.`
  }

  if (action === "invite")
    return `Issued workspace invite to ${request.email} after access review.`

  if (action === "approved")
    return `Approved workspace access request from ${request.email}.`

  if (action === "denied")
    return `Denied workspace access request from ${request.email} after review.`

  return `Reopened workspace access request from ${request.email} for review.`
}

async function updateStatus(request: AccessRequest, status: "approved" | "denied" | "open") {
  const notes = actionNotes[request.id]?.trim() || defaultNote(request, status)
  pendingAction.value = `${request.id}:${status}`

  try {
    await $fetch(`/api/admin/access-requests/${request.id}/status`, {
      body: { expectedUpdatedAt: request.updatedAt, notes, status },
      method: "POST",
    })
    actionNotes[request.id] = ""
    await refresh()
    toastStore.push({
      title: "Access request updated",
      message: `The request is now ${status}.`,
      tone: status === "denied" ? "warning" : "success",
    })
  }
  catch (caughtError) {
    toastStore.push({
      title: "Access request update failed",
      message: caughtError instanceof Error ? caughtError.message : "The request could not be updated.",
      tone: "danger",
    })
  }
  finally {
    pendingAction.value = ""
  }
}

async function issueInvite(request: AccessRequest) {
  const notes = actionNotes[request.id]?.trim() || defaultNote(request, "invite")
  pendingAction.value = `${request.id}:invite`

  try {
    const invite = await $fetch<InviteResponse>(`/api/admin/access-requests/${request.id}/invite`, {
      body: { expectedUpdatedAt: request.updatedAt, notes },
      method: "POST",
    })
    lastInviteByRequestId[request.id] = invite
    actionNotes[request.id] = ""
    await refresh()
    toastStore.push({
      title: "Invite issued",
      message: "Use the generated link below to send the approved member their signup invite.",
      tone: "success",
    })
  }
  catch (caughtError) {
    toastStore.push({
      title: "Invite failed",
      message: caughtError instanceof Error ? caughtError.message : "The invite could not be generated.",
      tone: "danger",
    })
  }
  finally {
    pendingAction.value = ""
  }
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Admin"
      title="Access requests"
      description="Review workspace-access requests, record decisions, and issue invite links."
    >
      <template #actions>
        <BaseBadge :tone="data?.mode === 'mock' ? 'neutral' : 'success'">
          {{ data?.mode || "loading" }}
        </BaseBadge>
        <BaseButton variant="secondary" :disabled="pending" @click="refresh">
          {{ pending ? "Refreshing..." : "Refresh" }}
        </BaseButton>
      </template>
    </PageIntro>

    <section v-if="data?.warning" class="panel-inset p-5 border border-[var(--warning)]">
      <p class="text-sm text-[var(--warning)] font-semibold">
        Supabase access-request queue not enabled
      </p>
      <p class="muted text-sm leading-6 mt-2">
        {{ data.warning }}
      </p>
    </section>

    <div class="gap-4 grid md:grid-cols-4">
      <MetricTile label="Open" :value="counts.open" context="Awaiting review." />
      <MetricTile label="Approved" :value="counts.approved" context="Approved but not necessarily invited." />
      <MetricTile label="Invited" :value="counts.invited" context="Invite token issued." />
      <MetricTile label="Denied" :value="counts.denied" context="Rejected after review." />
    </div>

    <section class="panel p-6">
      <div class="gap-4 grid md:grid-cols-[minmax(0,1fr)_240px]">
        <TextInput
          v-model="filters.query"
          label="Search requests"
          placeholder="Name, email, company, role, or request detail"
        />
        <SelectInput v-model="filters.status" label="Status" :options="statusOptions" />
      </div>
    </section>

    <div class="gap-4 grid">
      <article v-for="request in filteredRequests" :key="request.id" class="panel p-6">
        <div class="gap-6 grid xl:grid-cols-[minmax(0,1fr)_380px]">
          <div class="min-w-0">
            <div class="flex flex-wrap gap-2">
              <BaseBadge :tone="statusTone(request.status)">
                {{ request.status }}
              </BaseBadge>
              <BaseBadge tone="neutral">
                {{ formatChoice(request.role) }}
              </BaseBadge>
              <BaseBadge tone="neutral">
                {{ formatChoice(request.companyStage) }}
              </BaseBadge>
              <BaseBadge tone="neutral">
                {{ formatChoice(request.timeline) }}
              </BaseBadge>
              <BaseBadge v-if="isAccountHelpRequest(request)" tone="accent">
                account help
              </BaseBadge>
            </div>

            <h2 class="text-lg font-semibold mt-4">
              {{ request.name }}
            </h2>
            <p class="muted text-sm leading-6 mt-1 break-all">
              {{ request.email }}
            </p>
            <p v-if="request.company" class="text-sm leading-6 mt-3">
              {{ request.company }}
            </p>
            <p class="text-sm leading-7 mt-4 whitespace-pre-line">
              {{ request.useCase }}
            </p>

            <div class="muted text-xs leading-5 mt-5">
              <p>Source: {{ request.source || "site" }}</p>
              <p v-if="isAccountHelpRequest(request)">
                Verify account ownership before issuing a replacement invite or advising on account reset.
              </p>
              <p>Opened {{ formatDate(request.createdAt) }} · {{ formatRelativeDate(request.createdAt) }}</p>
              <p v-if="request.reviewedAt">
                Reviewed {{ formatDate(request.reviewedAt) }}
              </p>
              <p v-if="request.inviteTokenIssuedAt">
                Invite issued {{ formatDate(request.inviteTokenIssuedAt) }}
              </p>
              <p v-if="request.inviteAcceptedAt">
                Invite accepted {{ formatDate(request.inviteAcceptedAt) }}
              </p>
              <p v-else-if="request.inviteExpiresAt">
                Invite expires {{ formatDate(request.inviteExpiresAt) }}
              </p>
            </div>

            <div v-if="request.adminNotes" class="surface-divider mt-4">
              <p class="text-xs text-[var(--muted)] tracking-[0.12em] font-semibold uppercase">
                Admin note
              </p>
              <p class="text-sm leading-6 mt-2">
                {{ request.adminNotes }}
              </p>
            </div>
          </div>

          <div class="panel-inset p-4">
            <h3 class="text-sm font-semibold">
              Review action
            </h3>
            <p class="muted text-xs leading-5 mt-2">
              Notes are stored with the request. Issuing an invite creates a 30-day token tied to the approved email.
            </p>

            <TextareaInput
              v-model="actionNotes[request.id]"
              class="mt-4"
              label="Admin note"
              placeholder="Add the reason for this access decision"
              :rows="4"
            />

            <div v-if="lastInviteByRequestId[request.id]?.inviteUrl" class="surface-divider mt-4">
              <p class="text-xs text-[var(--muted)] tracking-[0.12em] font-semibold uppercase">
                Invite link
              </p>
              <p class="text-xs leading-5 mt-2 break-all">
                {{ lastInviteByRequestId[request.id]?.inviteUrl }}
              </p>
              <p class="muted text-xs leading-5 mt-2">
                Store or send this link now. The token is shown only in this response.
              </p>
            </div>

            <div class="mt-4 flex flex-wrap gap-3">
              <BaseButton
                v-if="request.status !== 'approved'"
                variant="secondary"
                :disabled="Boolean(pendingAction)"
                @click="updateStatus(request, 'approved')"
              >
                {{ pendingAction === `${request.id}:approved` ? "Saving..." : "Approve" }}
              </BaseButton>
              <BaseButton
                :disabled="Boolean(pendingAction)"
                @click="issueInvite(request)"
              >
                {{ pendingAction === `${request.id}:invite` ? "Issuing..." : "Issue invite" }}
              </BaseButton>
              <BaseButton
                v-if="request.status !== 'denied'"
                variant="danger"
                :disabled="Boolean(pendingAction)"
                @click="updateStatus(request, 'denied')"
              >
                {{ pendingAction === `${request.id}:denied` ? "Saving..." : "Deny" }}
              </BaseButton>
              <BaseButton
                v-if="request.status !== 'open'"
                variant="ghost"
                :disabled="Boolean(pendingAction)"
                @click="updateStatus(request, 'open')"
              >
                Reopen
              </BaseButton>
            </div>
          </div>
        </div>
      </article>

      <EmptyState
        v-if="!filteredRequests.length"
        title="No access requests match these filters"
        description="Requests from the public access form will appear here after submission."
        icon="i-carbon-user-follow"
      />
    </div>
  </div>
</template>
