<script setup lang="ts">
import type { PrivacyRequest } from "~/shared/types/domain"
import { formatRelativeDate } from "~/shared/utils/format"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin privacy requests")

const { data, pending, refresh } = await useFetch<{ requests: PrivacyRequest[] }>("/api/admin/privacy-requests")
const actionNotes = reactive<Record<string, string>>({})
const actionPending = ref("")
const requests = computed(() => data.value?.requests || [])

function formatRequestType(type: PrivacyRequest["type"]) {
  return type.replaceAll("_", " ")
}

async function updateRequestStatus(request: PrivacyRequest, status: "reviewed" | "resolved") {
  const notes = actionNotes[request.id]?.trim()
  if (!notes || notes.length < 8)
    return

  actionPending.value = `${request.id}:${status}`

  try {
    await $fetch(`/api/admin/privacy-requests/${request.id}/status`, {
      method: "POST",
      body: { notes, status },
    })
    actionNotes[request.id] = ""
    await refresh()
  }
  finally {
    actionPending.value = ""
  }
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Admin"
      title="Privacy requests"
      description="Operator queue for account deletion, correction, export, visibility, and safety-privacy follow-up."
    >
      <template #actions>
        <BaseButton variant="secondary" :disabled="pending" @click="refresh">
          Refresh
        </BaseButton>
      </template>
    </PageIntro>

    <section class="panel p-6">
      <div class="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Request queue
          </h2>
          <p class="muted text-sm leading-6 mt-2">
            Requests submitted from account settings appear here from Supabase or the local server store.
          </p>
        </div>
        <BaseBadge tone="accent">
          {{ requests.length }} open item{{ requests.length === 1 ? "" : "s" }}
        </BaseBadge>
      </div>

      <div v-if="requests.length" class="surface-row-list mt-5">
        <article v-for="request in requests" :key="request.id" class="surface-row">
          <div class="flex flex-wrap gap-3 items-start justify-between">
            <div>
              <p class="text-sm font-semibold capitalize">
                {{ formatRequestType(request.type) }}
              </p>
              <p class="muted text-sm leading-6 mt-2">
                {{ request.details }}
              </p>
            </div>
            <BaseBadge :tone="request.status === 'open' ? 'warning' : request.status === 'reviewed' ? 'accent' : 'success'">
              {{ request.status }}
            </BaseBadge>
          </div>
          <p class="muted text-xs mt-4">
            User {{ request.userId }} · {{ formatRelativeDate(request.createdAt) }}
          </p>
          <div v-if="request.status !== 'resolved'" class="surface-divider mt-4 gap-3 grid">
            <TextareaInput
              v-model="actionNotes[request.id]"
              label="Operator note"
              helper="Required before marking this request reviewed or resolved."
              :rows="3"
            />
            <div class="flex flex-wrap gap-3 justify-end">
              <BaseButton
                v-if="request.status === 'open'"
                variant="secondary"
                :disabled="actionPending === `${request.id}:reviewed` || (actionNotes[request.id] || '').trim().length < 8"
                @click="updateRequestStatus(request, 'reviewed')"
              >
                {{ actionPending === `${request.id}:reviewed` ? "Saving..." : "Mark reviewed" }}
              </BaseButton>
              <BaseButton
                :disabled="actionPending === `${request.id}:resolved` || (actionNotes[request.id] || '').trim().length < 8"
                @click="updateRequestStatus(request, 'resolved')"
              >
                {{ actionPending === `${request.id}:resolved` ? "Saving..." : "Resolve" }}
              </BaseButton>
            </div>
          </div>
        </article>
      </div>

      <EmptyState
        v-else
        class="mt-6"
        icon="i-carbon-data-vis-4"
        title="No privacy requests"
        description="Account deletion, correction, visibility, safety, and trust-review requests will appear here when members submit them."
      />
    </section>
  </div>
</template>
