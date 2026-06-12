<script setup lang="ts">
import type { AdminAction } from "~/shared/types/domain"
import type { AdminAuditFilters } from "~/shared/utils/admin"
import { buildAdminAuditEntries, filterAdminAuditEntries, mergeAdminActions } from "~/shared/utils/admin"
import { formatAdminActionType, formatDate } from "~/shared/utils/format"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin audit log")

const workspaceStore = useWorkspaceStore()
const requestFetch = useRequestFetch()
const { data: auditData, pending, refresh } = await useAsyncData("admin-audit", () => requestFetch<{ actions: AdminAction[] }>("/api/admin/audit"))

const filters = reactive<AdminAuditFilters>({
  query: "",
  actionType: "all",
  actorId: "all",
  targetType: "all",
})

const actionTypeOptions = [
  { label: "All actions", value: "all" },
  { label: "Reviewed report", value: "review_report" },
  { label: "Resolved report", value: "resolve_report" },
  { label: "Reviewed privacy request", value: "review_privacy_request" },
  { label: "Resolved privacy request", value: "resolve_privacy_request" },
  { label: "Reviewed evidence", value: "review_evidence" },
  { label: "Assigned case", value: "assign_case" },
  { label: "Escalated case", value: "escalate_case" },
  { label: "Suspended user", value: "suspend_user" },
  { label: "Reinstated user", value: "reinstate_user" },
  { label: "Changed user role", value: "change_user_role" },
  { label: "Warned user", value: "warn_user" },
  { label: "Removed content", value: "remove_content" },
]

const actorOptions = computed(() => [
  { label: "All admins", value: "all" },
  ...workspaceStore.data.users
    .filter(user => ["admin", "investor_admin"].includes(user.role))
    .map((user) => {
      const profile = workspaceStore.data.profiles.find(item => item.userId === user.id)
      return {
        label: profile?.displayName || user.email,
        value: user.id,
      }
    }),
])

const targetTypeOptions = [
  { label: "All targets", value: "all" },
  { label: "Users", value: "user" },
  { label: "Reports", value: "report" },
  { label: "Privacy requests", value: "privacy_request" },
  { label: "File uploads", value: "file_upload" },
  { label: "Profiles", value: "profile" },
  { label: "Messages", value: "message" },
  { label: "Opportunities", value: "opportunity" },
]

const auditSeed = computed(() => ({
  ...workspaceStore.data,
  adminActions: mergeAdminActions(auditData.value?.actions || [], workspaceStore.data.adminActions),
}))
const entries = computed(() => filterAdminAuditEntries(buildAdminAuditEntries(auditSeed.value), filters))
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Admin"
      title="Audit log"
      description="Search every recorded moderation and enforcement action by actor, target, or action type."
    >
      <template #actions>
        <BaseButton variant="secondary" :disabled="pending" @click="refresh">
          {{ pending ? "Refreshing..." : "Refresh" }}
        </BaseButton>
      </template>
    </PageIntro>

    <section class="panel p-6">
      <div class="gap-4 grid md:grid-cols-2 xl:grid-cols-4">
        <TextInput
          v-model="filters.query"
          label="Search audit log"
          placeholder="Actor, target, or note"
          helper="Search across admin names, targets, and audit notes."
        />
        <SelectInput v-model="filters.actionType" label="Action type" :options="actionTypeOptions" />
        <SelectInput v-model="filters.actorId" label="Admin actor" :options="actorOptions" />
        <SelectInput v-model="filters.targetType" label="Target type" :options="targetTypeOptions" />
      </div>
    </section>

    <div class="gap-4 grid">
      <article v-for="entry in entries" :key="entry.action.id" class="panel p-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap gap-2">
              <BaseBadge tone="accent">
                {{ formatAdminActionType(entry.action.type) }}
              </BaseBadge>
              <BaseBadge tone="neutral">
                {{ entry.action.targetType }}
              </BaseBadge>
            </div>
            <h2 class="text-base font-semibold mt-4">
              {{ entry.targetLabel }}
            </h2>
            <p class="muted text-sm leading-6 mt-2">
              {{ entry.targetContext }}
            </p>
            <p class="text-sm leading-6 mt-4">
              {{ entry.action.notes }}
            </p>
            <p class="muted text-xs mt-4">
              {{ entry.adminProfile?.displayName || entry.admin?.email || "Admin" }} · {{ formatDate(entry.action.createdAt) }}
            </p>
          </div>
        </div>
      </article>

      <EmptyState
        v-if="!entries.length"
        title="No audit entries match these filters"
        description="Broaden the query or clear one of the filters to inspect the full moderation history."
        icon="i-carbon-document-tasks"
      />
    </div>
  </div>
</template>
