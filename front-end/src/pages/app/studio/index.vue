<script setup lang="ts">
import type { OrganizationInvitation, OrganizationWorkspaceDocument } from "~/shared/types/organizations"
import { formatOrganizationKind, organizationMembershipFor } from "~/shared/utils/organizations"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Team and Studio workspaces")

const { authStore } = useCurrentMember()
const organizationStore = useOrganizationStore()
const toastStore = useToastStore()
const createOpen = ref(false)
const pending = ref(false)
const formError = ref("")
const form = reactive({
  description: "",
  kind: "startup_team" as "startup_team" | "venture_studio",
  name: "",
  website: "",
})

const currentUserId = computed(() => authStore.currentUser?.id || "")
const activeWorkspaces = computed(() => organizationStore.snapshot.workspaces.filter(workspace =>
  Boolean(organizationMembershipFor(workspace, currentUserId.value)),
))
const pendingInvitations = computed(() => organizationStore.snapshot.workspaces.flatMap(workspace =>
  workspace.invitations
    .filter(invitation => invitation.status === "pending")
    .map(invitation => ({ invitation, workspace })),
))
const canCreate = computed(() => authStore.currentUser?.subscriptionPlan === "team")
const openApprovals = computed(() => activeWorkspaces.value.reduce((total, workspace) =>
  total + workspace.approvalRequests.filter(approval => approval.status === "pending").length, 0))
const openTasks = computed(() => activeWorkspaces.value.reduce((total, workspace) =>
  total + workspace.tasks.filter(task => task.status !== "done").length, 0))

function errorMessage(error: unknown, fallback: string) {
  const payload = error as { data?: { message?: string }, statusMessage?: string }
  return payload.data?.message || payload.statusMessage || fallback
}

async function createWorkspace() {
  pending.value = true
  formError.value = ""
  try {
    const workspace = await organizationStore.create({ ...form })
    createOpen.value = false
    toastStore.push({
      message: `${workspace.organization.name} is ready for members, ventures, projects, and approval policies.`,
      title: "Organization created",
      tone: "success",
    })
    await navigateTo(`/app/studio/${workspace.organization.id}`)
  }
  catch (error) {
    formError.value = errorMessage(error, "The organization workspace could not be created.")
  }
  finally {
    pending.value = false
  }
}

async function respondToInvitation(workspace: OrganizationWorkspaceDocument, invitation: OrganizationInvitation, response: "accepted" | "declined") {
  pending.value = true
  try {
    await organizationStore.mutate(workspace, {
      action: "respond_invitation",
      invitationId: invitation.id,
      response,
    })
    toastStore.push({
      message: response === "accepted"
        ? `You joined ${workspace.organization.name}.`
        : `You declined the invitation to ${workspace.organization.name}.`,
      title: response === "accepted"
        ? "Invitation accepted"
        : "Invitation declined",
      tone: response === "accepted"
        ? "success"
        : "info",
    })
    if (response === "accepted")
      await navigateTo(`/app/studio/${workspace.organization.id}`)
  }
  catch (error) {
    toastStore.push({
      message: errorMessage(error, "The invitation response could not be saved."),
      title: "Invitation not updated",
      tone: "danger",
    })
  }
  finally {
    pending.value = false
  }
}

onMounted(() => organizationStore.load())
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Team / Studio"
      title="Organization workspaces"
    >
      <template #actions>
        <BaseButton v-if="canCreate" @click="createOpen = true">
          <span class="i-carbon-add" />
          Create organization
        </BaseButton>
        <BaseButton v-else variant="secondary" to="/app/billing">
          Team plan required
        </BaseButton>
      </template>
    </PageIntro>

    <div class="gap-4 grid sm:grid-cols-2 xl:grid-cols-4">
      <MetricTile label="Organizations" :value="activeWorkspaces.length" context="Active memberships" />
      <MetricTile label="Portfolio ventures" :value="activeWorkspaces.reduce((total, workspace) => total + workspace.ventures.filter(venture => venture.status !== 'archived').length, 0)" context="Across Team and Studio workspaces" />
      <MetricTile label="Open work" :value="openTasks" context="Tasks not marked done" />
      <MetricTile label="Approvals" :value="openApprovals" context="Waiting for an eligible reviewer" />
    </div>

    <section v-if="pendingInvitations.length" class="panel p-5 md:p-6">
      <div class="flex gap-3 items-center">
        <span class="i-carbon-email-new text-xl text-[var(--accent)]" />
        <h2 class="text-lg font-semibold">
          Invitations
        </h2>
      </div>
      <div class="surface-row-list mt-4">
        <div v-for="item in pendingInvitations" :key="item.invitation.id" class="surface-row flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="font-semibold">
              {{ item.workspace.organization.name }}
            </p>
            <p class="muted text-sm mt-1">
              {{ item.invitation.title }} · {{ item.invitation.role }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <BaseButton size="sm" :disabled="pending" @click="respondToInvitation(item.workspace, item.invitation, 'accepted')">
              Accept
            </BaseButton>
            <BaseButton size="sm" variant="ghost" :disabled="pending" @click="respondToInvitation(item.workspace, item.invitation, 'declined')">
              Decline
            </BaseButton>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          Your organizations
        </h2>
        <BaseBadge tone="neutral">
          {{ activeWorkspaces.length }} active
        </BaseBadge>
      </div>

      <div v-if="organizationStore.loading" class="muted text-sm mt-5" role="status">
        Loading organization workspaces...
      </div>
      <div v-else-if="activeWorkspaces.length" class="mt-4 gap-4 grid lg:grid-cols-2">
        <NuxtLink v-for="workspace in activeWorkspaces" :key="workspace.organization.id" :to="`/app/studio/${workspace.organization.id}`" class="panel p-5 transition hover:border-[var(--line-strong)]">
          <div class="flex gap-4 items-start justify-between">
            <div class="min-w-0">
              <p class="text-lg font-semibold">
                {{ workspace.organization.name }}
              </p>
              <p class="muted text-sm mt-1">
                {{ formatOrganizationKind(workspace.organization.kind) }} · {{ organizationMembershipFor(workspace, currentUserId)?.role }}
              </p>
            </div>
            <BaseBadge :tone="workspace.organization.status === 'active' ? 'success' : 'neutral'">
              {{ workspace.organization.status }}
            </BaseBadge>
          </div>
          <p class="muted text-sm leading-6 mt-4">
            {{ workspace.organization.description }}
          </p>
          <div class="text-sm mt-5 gap-3 grid grid-cols-3">
            <div>
              <p class="font-semibold">
                {{ workspace.memberships.length }}
              </p>
              <p class="muted text-xs mt-1">
                Members
              </p>
            </div>
            <div>
              <p class="font-semibold">
                {{ workspace.ventures.length }}
              </p>
              <p class="muted text-xs mt-1">
                Ventures
              </p>
            </div>
            <div>
              <p class="font-semibold">
                {{ workspace.projects.filter(project => !['completed', 'archived'].includes(project.status)).length }}
              </p>
              <p class="muted text-xs mt-1">
                Projects
              </p>
            </div>
          </div>
        </NuxtLink>
      </div>
      <EmptyState
        v-else
        class="mt-4"
        icon="i-carbon-workspace"
        title="No organization workspace yet"
        :description="canCreate ? 'Create a startup-team or venture-studio workspace to begin.' : 'An organization owner can invite you, or you can activate the Team plan to create one.'"
      />
    </section>

    <BaseDialog v-model="createOpen" title="Create organization">
      <form class="gap-4 grid" @submit.prevent="createWorkspace">
        <TextInput v-model="form.name" label="Organization name" />
        <SelectInput
          v-model="form.kind"
          label="Workspace type"
          :options="[
            { label: 'Startup team', value: 'startup_team' },
            { label: 'Venture studio', value: 'venture_studio' },
          ]"
        />
        <TextareaInput v-model="form.description" label="Operating focus" :rows="4" />
        <TextInput v-model="form.website" label="Website" helper="Optional. Use an HTTP or HTTPS URL." />
        <p v-if="formError" class="field-error">
          {{ formError }}
        </p>
        <div class="flex justify-end">
          <BaseButton type="submit" :disabled="pending">
            {{ pending ? "Creating..." : "Create organization" }}
          </BaseButton>
        </div>
      </form>
    </BaseDialog>
  </div>
</template>
