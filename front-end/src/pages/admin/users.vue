<script setup lang="ts">
import type { AdminUserFilters, AdminUserRow } from "~/shared/utils/admin"
import { buildAdminUserRows, filterAdminUserRows } from "~/shared/utils/admin"
import { formatDate, formatPlanName, formatRelativeDate } from "~/shared/utils/format"

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

const roleOptions = [
  { label: "All roles", value: "all" },
  { label: "Founder", value: "founder" },
  { label: "Collaborator", value: "collaborator" },
  { label: "Admin", value: "admin" },
  { label: "Investor admin", value: "investor_admin" },
]

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

function buildDefaultNote(row: AdminUserRow) {
  const label = row.profile?.displayName || row.user.email
  return row.user.suspendedAt
    ? `Reinstated ${label} after admin review.`
    : `Suspended ${label} pending moderation review.`
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
      message: caughtError instanceof Error ? caughtError.message : "The moderation action could not be completed.",
      tone: "danger",
    })
  }
  finally {
    pendingByUserId[row.user.id] = false
  }
}
</script>

<template>
  <div class="gap-6 grid">
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
      <div class="overflow-x-auto">
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
                <div class="flex flex-wrap gap-2">
                  <BaseBadge tone="neutral">
                    {{ row.user.role }}
                  </BaseBadge>
                  <BaseBadge :tone="row.subscription?.plan === 'free' ? 'neutral' : 'accent'">
                    {{ formatPlanName(row.subscription?.plan || "free") }}
                  </BaseBadge>
                  <BaseBadge :tone="row.user.onboardingCompleted ? 'success' : 'warning'">
                    {{ row.user.onboardingCompleted ? "Onboarded" : "Incomplete" }}
                  </BaseBadge>
                </div>
                <p class="muted text-xs mt-3">
                  Joined {{ formatDate(row.user.createdAt) }}
                </p>
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
              <td class="px-4 py-4 min-w-[270px]">
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
                  class="mt-3"
                  :disabled="pendingByUserId[row.user.id]"
                  :variant="row.user.suspendedAt ? 'secondary' : 'danger'"
                  @click="toggleSuspension(row)"
                >
                  {{ pendingByUserId[row.user.id] ? "Saving..." : row.user.suspendedAt ? "Reinstate" : "Suspend" }}
                </BaseButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!rows.length" class="p-6">
        <EmptyState
          title="No users match these filters"
          description="Try broadening the search or clearing one of the status filters."
          icon="i-carbon-user-multiple"
        />
      </div>
    </section>
  </div>
</template>
