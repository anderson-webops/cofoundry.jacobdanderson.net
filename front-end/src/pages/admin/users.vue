<script setup lang="ts">
import type { AppRole } from "~/shared/types/domain"
import type { AdminUserFilters, AdminUserRow } from "~/shared/utils/admin"
import { computed, reactive, watchEffect } from "vue"
import { definePageMeta } from "#app/composables/pages"
import SelectInput from "~/components/forms/SelectInput.vue"
import TextInput from "~/components/forms/TextInput.vue"
import BaseBadge from "~/components/ui/BaseBadge.vue"
import BaseButton from "~/components/ui/BaseButton.vue"
import EmptyState from "~/components/ui/EmptyState.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { usePageSeo } from "~/composables/usePageSeo"
import { buildAdminUserRows, filterAdminUserRows } from "~/shared/utils/admin"
import { formatDate, formatPlanName, formatRelativeDate } from "~/shared/utils/format"
import { useAuthStore } from "~/stores/auth"
import { useToastStore } from "~/stores/toast"
import { useWorkspaceStore } from "~/stores/workspace"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin users")

const toastStore = useToastStore()
const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()

const filters = reactive<AdminUserFilters>({
  query: "",
  role: "all",
  status: "all",
  onboarding: "all",
})

const moderationNotes = reactive<Record<string, string>>({})
const pendingByUserId = reactive<Record<string, boolean>>({})
const pendingEmailByUserId = reactive<Record<string, boolean>>({})
const pendingRoleByUserId = reactive<Record<string, boolean>>({})
const roleSelections = reactive<Record<string, AppRole | "">>({})

const roleOptions = [
  { label: "All roles", value: "all" },
  { label: "Founder", value: "founder" },
  { label: "Collaborator", value: "collaborator" },
  { label: "Admin", value: "admin" },
  { label: "Investor admin", value: "investor_admin" },
]

const roleAssignmentOptions = roleOptions.filter(option => option.value !== "all")

const statusOptions = [
  { label: "All users", value: "all" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
]

const onboardingOptions = [
  { label: "All onboarding states", value: "all" },
  { label: "Complete", value: "complete" },
  { label: "Incomplete", value: "incomplete" },
]

const rows = computed(() => filterAdminUserRows(buildAdminUserRows(workspaceStore.data), filters))
const isFullAdmin = computed(() => authStore.currentUser?.role === "admin")

function canModerateUser(row: AdminUserRow) {
  if (!authStore.currentUser || row.user.id === authStore.currentUser.id)
    return false

  return isFullAdmin.value || !["admin", "investor_admin"].includes(row.user.role)
}

function canManageUserSecurity(row: AdminUserRow) {
  return Boolean(isFullAdmin.value && authStore.currentUser && row.user.id !== authStore.currentUser.id)
}

function syncRoleSelections(currentRows: AdminUserRow[]) {
  currentRows.forEach((row) => {
    if (!roleSelections[row.user.id])
      roleSelections[row.user.id] = row.user.role
  })
}

syncRoleSelections(rows.value)

watchEffect(() => {
  syncRoleSelections(rows.value)
})

function formatRole(role: AppRole) {
  return role.replaceAll("_", " ")
}

function buildDefaultNote(row: AdminUserRow) {
  const label = row.profile?.displayName || row.user.email
  return row.user.suspendedAt
    ? `Reinstated ${label} after admin review.`
    : `Suspended ${label} pending moderation review.`
}

function buildDefaultRoleNote(row: AdminUserRow, nextRole: AppRole) {
  const label = row.profile?.displayName || row.user.email
  return `Changed ${label} role from ${formatRole(row.user.role)} to ${formatRole(nextRole)} after admin review.`
}

function buildDefaultEmailVerificationNote(row: AdminUserRow) {
  const label = row.profile?.displayName || row.user.email
  return `Verified ${label} email after invite, domain, or operator evidence review.`
}

async function toggleSuspension(row: AdminUserRow) {
  if (!authStore.currentUser)
    return

  pendingByUserId[row.user.id] = true

  try {
    const note = moderationNotes[row.user.id]?.trim() || buildDefaultNote(row)

    if (row.user.suspendedAt) {
      await workspaceStore.reinstateUser(row.user.id, authStore.currentUser.id, note)
      toastStore.push({
        title: "User reinstated",
        message: "The server approved the reinstatement and the audit log has been updated.",
        tone: "success",
      })
    }
    else {
      await workspaceStore.suspendUser(row.user.id, authStore.currentUser.id, note)
      toastStore.push({
        title: "User suspended",
        message: "The account is now suspended and the moderation note was recorded.",
        tone: "warning",
      })
    }

    moderationNotes[row.user.id] = ""
  }
  catch (caughtError) {
    toastStore.push({
      title: "Admin action failed",
      message: caughtError instanceof Error
        ? caughtError.message
        : "The moderation action could not be completed.",
      tone: "danger",
    })
  }
  finally {
    pendingByUserId[row.user.id] = false
  }
}

async function changeRole(row: AdminUserRow) {
  if (!authStore.currentUser)
    return

  const nextRole = (roleSelections[row.user.id] || row.user.role) as AppRole
  if (nextRole === row.user.role) {
    toastStore.push({
      title: "Role unchanged",
      message: "Choose a different role before recording an admin role change.",
      tone: "info",
    })
    return
  }

  pendingRoleByUserId[row.user.id] = true

  try {
    const note = moderationNotes[row.user.id]?.trim() || buildDefaultRoleNote(row, nextRole)
    await workspaceStore.changeUserRole(row.user.id, authStore.currentUser.id, nextRole, note)
    toastStore.push({
      title: "Role updated",
      message: "The role change was approved by the server and added to the audit log.",
      tone: "success",
    })
    moderationNotes[row.user.id] = ""
    roleSelections[row.user.id] = nextRole
  }
  catch (caughtError) {
    toastStore.push({
      title: "Role change failed",
      message: caughtError instanceof Error
        ? caughtError.message
        : "The role change could not be completed.",
      tone: "danger",
    })
  }
  finally {
    pendingRoleByUserId[row.user.id] = false
  }
}

async function verifyEmail(row: AdminUserRow) {
  if (!authStore.currentUser || row.user.verifiedEmail)
    return

  pendingEmailByUserId[row.user.id] = true

  try {
    const note = moderationNotes[row.user.id]?.trim() || buildDefaultEmailVerificationNote(row)
    await workspaceStore.verifyUserEmail(row.user.id, authStore.currentUser.id, note)
    toastStore.push({
      title: "Email verified",
      message: "The server recorded the verification and added an audit entry.",
      tone: "success",
    })
    moderationNotes[row.user.id] = ""
  }
  catch (caughtError) {
    toastStore.push({
      title: "Email verification failed",
      message: caughtError instanceof Error
        ? caughtError.message
        : "The email verification could not be recorded.",
      tone: "danger",
    })
  }
  finally {
    pendingEmailByUserId[row.user.id] = false
  }
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Admin"
      title="Users"
      description="Search members, review status, and apply server-approved moderation actions with an attached audit note."
    />

    <section class="panel p-6">
      <div class="gap-4 grid md:grid-cols-2 xl:grid-cols-4">
        <TextInput
          v-model="filters.query"
          label="Search users"
          placeholder="Name, email, headline, or location"
          helper="Search across core profile and account fields."
        />
        <SelectInput v-model="filters.role" label="Role" :options="roleOptions" />
        <SelectInput v-model="filters.status" label="Status" :options="statusOptions" />
        <SelectInput v-model="filters.onboarding" label="Onboarding" :options="onboardingOptions" />
      </div>
    </section>

    <section class="panel overflow-hidden">
      <div v-if="rows.length" class="p-4 lg:hidden">
        <div class="surface-row-list">
          <article v-for="row in rows" :key="row.user.id" class="surface-row">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div class="min-w-0">
                <p class="font-semibold">
                  {{ row.profile?.displayName || row.user.email }}
                </p>
                <p class="muted text-xs mt-1 break-all">
                  {{ row.user.email }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <BaseBadge :tone="row.user.suspendedAt ? 'danger' : 'success'">
                  {{ row.user.suspendedAt ? "Suspended" : "Active" }}
                </BaseBadge>
                <BaseBadge :tone="row.user.verifiedEmail ? 'success' : 'warning'">
                  {{ row.user.verifiedEmail ? "Email verified" : "Email pending" }}
                </BaseBadge>
              </div>
            </div>

            <p v-if="row.profile?.headline" class="text-sm leading-6 mt-3">
              {{ row.profile.headline }}
            </p>

            <div class="text-sm mt-4 gap-3 grid grid-cols-2">
              <div>
                <p class="muted text-xs">
                  Role
                </p>
                <p class="font-semibold mt-1 capitalize">
                  {{ formatRole(row.user.role) }}
                </p>
              </div>
              <div>
                <p class="muted text-xs">
                  Plan
                </p>
                <p class="font-semibold mt-1">
                  {{ formatPlanName(row.subscription?.plan || "free") }}
                </p>
              </div>
              <div>
                <p class="muted text-xs">
                  Reports
                </p>
                <p class="font-semibold mt-1">
                  {{ row.openReportsCount }} open · {{ row.highPriorityReportsCount }} high
                </p>
              </div>
              <div>
                <p class="muted text-xs">
                  Activity
                </p>
                <p class="font-semibold mt-1">
                  {{ row.lastActiveAt ? formatRelativeDate(row.lastActiveAt) : "Unavailable" }}
                </p>
              </div>
            </div>

            <p class="muted text-xs mt-3">
              Joined {{ formatDate(row.user.createdAt) }} · {{ row.user.onboardingCompleted ? "Onboarding complete" : "Onboarding incomplete" }}
            </p>
            <p v-if="row.lastAdminAction" class="text-xs leading-5 mt-3">
              Last action: {{ row.lastAdminAction.notes }}
            </p>

            <div class="mt-4">
              <label class="block">
                <span class="sr-only">Moderation note</span>
                <input
                  v-model="moderationNotes[row.user.id]"
                  :aria-label="`Moderation note for ${row.profile?.displayName || row.user.email}`"
                  class="field-control text-xs"
                  placeholder="Moderation note for the audit log"
                >
              </label>
              <BaseButton
                v-if="canModerateUser(row)"
                class="mt-3 w-full"
                :disabled="pendingByUserId[row.user.id]"
                :variant="row.user.suspendedAt ? 'secondary' : 'danger'"
                @click="toggleSuspension(row)"
              >
                {{ pendingByUserId[row.user.id] ? "Saving..." : row.user.suspendedAt ? "Reinstate" : "Suspend" }}
              </BaseButton>
              <BaseButton
                v-if="canManageUserSecurity(row)"
                class="mt-3 w-full"
                :disabled="pendingEmailByUserId[row.user.id] || row.user.verifiedEmail"
                variant="secondary"
                @click="verifyEmail(row)"
              >
                {{ pendingEmailByUserId[row.user.id] ? "Saving..." : row.user.verifiedEmail ? "Email verified" : "Verify email" }}
              </BaseButton>
              <div v-if="canManageUserSecurity(row)" class="mt-4 pt-4 border-t border-[var(--line)]">
                <SelectInput
                  v-model="roleSelections[row.user.id]"
                  label="Role assignment"
                  :options="roleAssignmentOptions"
                  helper="Changes are server-approved and written to the audit log."
                />
                <BaseButton
                  class="mt-3 w-full"
                  :disabled="pendingRoleByUserId[row.user.id] || roleSelections[row.user.id] === row.user.role"
                  variant="secondary"
                  @click="changeRole(row)"
                >
                  {{ pendingRoleByUserId[row.user.id] ? "Saving..." : "Update role" }}
                </BaseButton>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div v-if="rows.length" class="hidden overflow-x-auto lg:block">
        <table class="text-sm text-left min-w-[1100px] w-full">
          <thead class="bg-[var(--panel-inset)]">
            <tr>
              <th class="font-semibold px-4 py-3">
                User
              </th>
              <th class="font-semibold px-4 py-3">
                Role / plan
              </th>
              <th class="font-semibold px-4 py-3">
                Trust & activity
              </th>
              <th class="font-semibold px-4 py-3">
                Moderation state
              </th>
              <th class="font-semibold px-4 py-3">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.user.id" class="align-top border-t border-[var(--line)]">
              <td class="px-4 py-4">
                <div class="font-semibold">
                  {{ row.profile?.displayName || row.user.email }}
                </div>
                <div class="muted text-xs mt-1">
                  {{ row.user.email }}
                </div>
                <div v-if="row.profile?.headline" class="text-xs leading-5 mt-2">
                  {{ row.profile.headline }}
                </div>
              </td>
              <td class="px-4 py-4">
                <div class="flex flex-wrap gap-2 items-center">
                  <p class="text-sm font-semibold capitalize">
                    {{ formatRole(row.user.role) }}
                  </p>
                  <BaseBadge :tone="row.subscription?.plan === 'free' ? 'neutral' : 'accent'">
                    {{ formatPlanName(row.subscription?.plan || "free") }}
                  </BaseBadge>
                </div>
                <p class="muted text-xs mt-3">
                  Joined {{ formatDate(row.user.createdAt) }}
                </p>
                <p class="muted text-xs mt-2">
                  {{ row.user.onboardingCompleted ? "Onboarding complete" : "Onboarding incomplete" }}
                </p>
                <BaseBadge class="mt-3" :tone="row.user.verifiedEmail ? 'success' : 'warning'">
                  {{ row.user.verifiedEmail ? "Email verified" : "Email pending" }}
                </BaseBadge>
              </td>
              <td class="px-4 py-4">
                <div class="text-sm">
                  Open reports: <span class="font-semibold">{{ row.openReportsCount }}</span>
                </div>
                <div class="text-sm mt-2">
                  High priority: <span class="font-semibold">{{ row.highPriorityReportsCount }}</span>
                </div>
                <p class="muted text-xs mt-3">
                  Last active {{ row.lastActiveAt ? formatRelativeDate(row.lastActiveAt) : "not available" }}
                </p>
              </td>
              <td class="px-4 py-4">
                <BaseBadge :tone="row.user.suspendedAt ? 'danger' : 'success'">
                  {{ row.user.suspendedAt ? "Suspended" : "Active" }}
                </BaseBadge>
                <p v-if="row.user.suspendedAt" class="muted text-xs mt-3">
                  Since {{ formatDate(row.user.suspendedAt) }}
                </p>
                <p v-if="row.lastAdminAction" class="text-xs leading-5 mt-3">
                  Last action: {{ row.lastAdminAction.notes }}
                </p>
              </td>
              <td class="px-4 py-4 min-w-[320px]">
                <label class="block">
                  <span class="sr-only">Moderation note</span>
                  <input
                    v-model="moderationNotes[row.user.id]"
                    :aria-label="`Moderation note for ${row.profile?.displayName || row.user.email}`"
                    class="field-control text-xs"
                    placeholder="Moderation note for the audit log"
                  >
                </label>
                <BaseButton
                  v-if="canModerateUser(row)"
                  class="mt-3"
                  :disabled="pendingByUserId[row.user.id]"
                  :variant="row.user.suspendedAt ? 'secondary' : 'danger'"
                  @click="toggleSuspension(row)"
                >
                  {{ pendingByUserId[row.user.id] ? "Saving..." : row.user.suspendedAt ? "Reinstate" : "Suspend" }}
                </BaseButton>
                <BaseButton
                  v-if="canManageUserSecurity(row)"
                  class="ml-2 mt-3"
                  :disabled="pendingEmailByUserId[row.user.id] || row.user.verifiedEmail"
                  variant="secondary"
                  @click="verifyEmail(row)"
                >
                  {{ pendingEmailByUserId[row.user.id] ? "Saving..." : row.user.verifiedEmail ? "Email verified" : "Verify email" }}
                </BaseButton>
                <div v-if="canManageUserSecurity(row)" class="mt-4 pt-4 border-t border-[var(--line)]">
                  <SelectInput
                    v-model="roleSelections[row.user.id]"
                    label="Role assignment"
                    :options="roleAssignmentOptions"
                    helper="Server-approved role updates are audited."
                  />
                  <BaseButton
                    class="mt-3"
                    :disabled="pendingRoleByUserId[row.user.id] || roleSelections[row.user.id] === row.user.role"
                    variant="secondary"
                    @click="changeRole(row)"
                  >
                    {{ pendingRoleByUserId[row.user.id] ? "Saving..." : "Update role" }}
                  </BaseButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="p-6">
        <EmptyState
          title="No users match these filters"
          description="Try broadening the search or clearing one of the status filters."
          icon="i-carbon-user-multiple"
        />
      </div>
    </section>
  </div>
</template>
