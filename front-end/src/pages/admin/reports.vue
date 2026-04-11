<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin reports")

const toastStore = useToastStore()
const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()

function resolve(reportId: string) {
  if (!authStore.currentUser)
    return

  workspaceStore.resolveReport(reportId, authStore.currentUser.id, "Resolved from reports queue.")
  toastStore.push({
    title: "Report resolved",
    message: "The report has been moved out of the moderation queue.",
    tone: "success",
  })
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Admin"
      title="Reports"
      description="Moderation queue for flagged profiles, messages, and opportunities."
    />

    <div class="gap-4 grid">
      <article v-for="report in workspaceStore.data.reports" :key="report.id" class="panel p-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div class="flex flex-wrap gap-2">
              <BaseBadge :tone="report.status === 'open' ? 'warning' : 'neutral'">
                {{ report.status }}
              </BaseBadge>
              <BaseBadge tone="neutral">
                {{ report.targetType }}
              </BaseBadge>
            </div>
            <h2 class="text-lg font-semibold mt-4">
              {{ report.reason }}
            </h2>
            <p class="muted text-sm leading-7 mt-3">
              {{ report.details }}
            </p>
          </div>
          <BaseButton v-if="report.status !== 'resolved'" variant="secondary" @click="resolve(report.id)">
            Resolve
          </BaseButton>
        </div>
      </article>
    </div>
  </div>
</template>
