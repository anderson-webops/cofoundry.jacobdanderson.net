<script setup lang="ts">
import { computed, reactive, ref } from "vue"
import { navigateTo } from "#app"
import { definePageMeta } from "#app/composables/pages"
import { NuxtLink } from "#components"
import SelectInput from "~/components/forms/SelectInput.vue"
import BaseBadge from "~/components/ui/BaseBadge.vue"
import BaseButton from "~/components/ui/BaseButton.vue"
import BaseDialog from "~/components/ui/BaseDialog.vue"
import EmptyState from "~/components/ui/EmptyState.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { useCurrentMember } from "~/composables/useCurrentMember"
import { useFeatureFlag } from "~/composables/useFeatureFlag"
import { usePageSeo } from "~/composables/usePageSeo"
import { useInvestmentWorkspaceStore } from "~/stores/investmentWorkspaces"
import { useOrganizationStore } from "~/stores/organizations"
import { useToastStore } from "~/stores/toast"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Fundraising")

const investmentEnabled = useFeatureFlag("featureInvestmentModule")
const investmentStore = useInvestmentWorkspaceStore()
const organizationStore = useOrganizationStore()
const toastStore = useToastStore()
const { authStore, workspaceStore } = useCurrentMember()
const createDialogOpen = ref(false)
const pending = ref(false)
const form = reactive({ opportunityId: "", organizationId: "" })

if (investmentEnabled.value) {
  await Promise.all([
    investmentStore.load(),
    organizationStore.load(),
    workspaceStore.loadWorkspace(),
  ])
}

const ownedOpportunities = computed(() => workspaceStore.data.opportunities.filter(item => item.ownerUserId === authStore.currentUser?.id && item.isOpen))
const availableOpportunities = computed(() => ownedOpportunities.value.filter(opportunity => !investmentStore.snapshot.workspaces.some(workspace => workspace.opportunityId === opportunity.id && !["declined", "withdrawn", "closed"].includes(workspace.application.status))))
const organizationOptions = computed(() => organizationStore.snapshot.workspaces
  .filter(item => item.memberships.some(membership => membership.userId === authStore.currentUser?.id))
  .map(item => ({ label: item.organization.name, value: item.organization.id })))

function statusLabel(status: string) {
  return status.replaceAll("_", " ")
}

function statusTone(status: string) {
  if (["accepted", "closed"].includes(status))
    return "success" as const
  if (["declined", "information_requested", "withdrawn"].includes(status))
    return "warning" as const
  if ([
    "under_review",
    "diligence",
    "committee_review",
    "submitted"
  ].includes(status)) {
    return "accent" as const
  }
  return "neutral" as const
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value))
    : "Not set"
}

function errorMessage(error: unknown) {
  const payload = error as { data?: { message?: string }, statusMessage?: string }
  return payload.data?.message || payload.statusMessage || "The fundraising workspace could not be created."
}

async function createWorkspace() {
  if (!form.opportunityId)
    return
  pending.value = true
  try {
    const workspace = await investmentStore.create({
      opportunityId: form.opportunityId,
      organizationId: form.organizationId || null,
    })
    toastStore.push({ message: `${workspace.companyName} is ready for fundraising planning.`, title: "Workspace created", tone: "success" })
    createDialogOpen.value = false
    Object.assign(form, { opportunityId: "", organizationId: "" })
    await navigateTo(`/app/investment/${workspace.id}`)
  }
  catch (error) {
    toastStore.push({
      message: errorMessage(error),
      title: "Workspace not created",
      tone: "danger"
    })
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Optional fundraising workspace"
      title="Fundraising"
      description="Plan a raise, manage your own outreach, prepare diligence, and apply for a separately governed program review."
    >
      <template #actions>
        <BaseButton v-if="investmentEnabled && availableOpportunities.length" @click="createDialogOpen = true">
          <span class="i-carbon-add" />
          New workspace
        </BaseButton>
      </template>
    </PageIntro>

    <EmptyState
      v-if="!investmentEnabled"
      icon="i-carbon-locked"
      title="Fundraising workspace disabled"
      description="This deployment has not enabled the separately governed investment workspace."
    />

    <template v-else>
      <div class="panel-inset text-sm leading-6 p-4 gap-3 grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
        <span class="i-carbon-information text-[var(--accent)]" />
        <p class="muted">
          Submitting shares a revision-bound application, readiness, and round snapshot. Investor contacts stay private; data-room records and updates enter review only when you mark them for sharing.
        </p>
        <NuxtLink to="/terms#investment-module" class="text-[var(--accent)] font-semibold">
          Supplemental terms
        </NuxtLink>
      </div>

      <div v-if="investmentStore.snapshot.workspaces.length" class="gap-4 grid lg:grid-cols-2">
        <NuxtLink
          v-for="workspace in investmentStore.snapshot.workspaces"
          :key="workspace.id"
          :to="`/app/investment/${workspace.id}`"
          class="panel p-5 gap-5 grid transition md:p-6 hover:border-[var(--line-strong)]"
        >
          <div class="flex gap-4 items-start justify-between">
            <div class="min-w-0">
              <p class="section-kicker">
                {{ statusLabel(workspace.status) }}
              </p>
              <h2 class="text-xl font-semibold mt-2 truncate">
                {{ workspace.companyName }}
              </h2>
              <p class="muted text-sm leading-6 mt-2 line-clamp-2">
                {{ workspace.application.companySummary || 'Fundraising planning workspace' }}
              </p>
            </div>
            <BaseBadge :tone="statusTone(workspace.application.status)">
              {{ statusLabel(workspace.application.status) }}
            </BaseBadge>
          </div>
          <div class="gap-3 grid grid-cols-2 sm:grid-cols-4">
            <div>
              <p class="muted text-xs uppercase">
                Target
              </p><p class="text-sm font-semibold mt-1">
                {{ workspace.rounds[0]?.targetAmount || workspace.application.requestedAmount || 'Planning' }}
              </p>
            </div>
            <div>
              <p class="muted text-xs uppercase">
                Prospects
              </p><p class="text-sm font-semibold mt-1">
                {{ workspace.prospects.length }}
              </p>
            </div>
            <div>
              <p class="muted text-xs uppercase">
                Data room
              </p><p class="text-sm font-semibold mt-1">
                {{ workspace.dataRoomItems.length }}
              </p>
            </div>
            <div>
              <p class="muted text-xs uppercase">
                Next close
              </p><p class="text-sm font-semibold mt-1">
                {{ formatDate(workspace.readiness.targetCloseAt) }}
              </p>
            </div>
          </div>
          <div class="pt-4 border-t border-[var(--line)] flex items-center justify-between">
            <span class="muted text-xs">Version {{ workspace.version }}</span>
            <span class="text-sm text-[var(--accent)] font-semibold inline-flex gap-2 items-center">Open workspace <span class="i-carbon-arrow-right" /></span>
          </div>
        </NuxtLink>
      </div>

      <EmptyState
        v-else
        icon="i-carbon-chart-line-data"
        title="No fundraising workspace"
        :description="availableOpportunities.length ? 'Create a workspace for one of your startup opportunities.' : 'Create a startup opportunity before opening a fundraising workspace.'"
      >
        <BaseButton v-if="availableOpportunities.length" @click="createDialogOpen = true">
          <span class="i-carbon-add" />New workspace
        </BaseButton>
        <BaseButton v-else to="/app/opportunities" variant="secondary">
          <span class="i-carbon-launch" />Startup opportunities
        </BaseButton>
      </EmptyState>

      <section class="unframed-section py-2 gap-4 grid md:grid-cols-3">
        <div>
          <span class="i-carbon-user-profile text-xl text-[var(--accent)]" /><h2 class="font-semibold mt-3">
            Applicant-owned outreach
          </h2><p class="muted text-sm leading-6 mt-2">
            CoFoundry does not discover, rank, or recommend investors. You maintain contacts you already know or independently identify.
          </p>
        </div>
        <div>
          <span class="i-carbon-locked text-xl text-[var(--accent)]" /><h2 class="font-semibold mt-3">
            Explicit review sharing
          </h2><p class="muted text-sm leading-6 mt-2">
            Program reviewers see submitted application fields and only the documents and updates you deliberately share.
          </p>
        </div>
        <div>
          <span class="i-carbon-connect text-xl text-[var(--accent)]" /><h2 class="font-semibold mt-3">
            Regulated execution elsewhere
          </h2><p class="muted text-sm leading-6 mt-2">
            Any securities transaction, if pursued, happens outside CoFoundry with counsel and a registered intermediary when required.
          </p>
        </div>
      </section>

      <div class="muted text-xs leading-5 flex flex-wrap gap-x-4 gap-y-2">
        <a href="https://www.sec.gov/resources-small-businesses/exempt-offerings/regulation-crowdfunding" target="_blank" rel="noopener noreferrer" class="hover:text-[var(--text)]">SEC Regulation Crowdfunding guide</a>
        <a href="https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/broker-dealers" target="_blank" rel="noopener noreferrer" class="hover:text-[var(--text)]">SEC broker-dealer guide</a>
      </div>
    </template>

    <BaseDialog :model-value="createDialogOpen" title="Create fundraising workspace" @update:model-value="createDialogOpen = false">
      <form class="gap-4 grid" @submit.prevent="createWorkspace">
        <SelectInput v-model="form.opportunityId" label="Startup opportunity" :options="availableOpportunities.map(item => ({ label: item.startupName, value: item.id }))" />
        <SelectInput v-if="organizationOptions.length" v-model="form.organizationId" label="Team or Studio workspace" :options="[{ label: 'No organization link', value: '' }, ...organizationOptions]" helper="Optional. Authorized organization members may see the linked program record and internal approvals." />
        <div class="panel-inset text-sm leading-6 p-4">
          The workspace starts as private fundraising planning. Nothing is sent to program staff until you accept the current supplemental terms and submit an application.
        </div>
        <BaseButton type="submit" :disabled="pending || !form.opportunityId">
          {{ pending ? 'Creating...' : 'Create workspace' }}
        </BaseButton>
      </form>
    </BaseDialog>
  </div>
</template>
