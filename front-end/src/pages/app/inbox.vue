<script setup lang="ts">
import { formatRelativeDate } from "~/shared/utils/format"
import { buildInboxSnapshot } from "~/shared/utils/inbox"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Inbox")

const toastStore = useToastStore()
const { authStore, workspaceStore } = useCurrentMember()
const currentUserId = computed(() => authStore.currentUser?.id || "")
const digestPending = ref(false)

const inboxSnapshot = computed(() => currentUserId.value ? buildInboxSnapshot(workspaceStore.data, currentUserId.value) : null)
const hasInboxActions = computed(() => Boolean(inboxSnapshot.value?.actions.length))

async function markNotificationRead(notificationId: string) {
  await workspaceStore.markNotificationRead(notificationId)
}

async function sendDigest() {
  digestPending.value = true

  try {
    const response = await $fetch<{
      configured: boolean
      delivered: boolean
      reason?: "email_digest_disabled" | "mail_not_configured" | "no_workspace_items" | "sent" | "delivery_failed"
      skipped?: boolean
      unreadCount: number
    }>("/api/notifications/digest", {
      method: "POST",
    })

    if (response.skipped && response.reason === "no_workspace_items") {
      toastStore.push({
        title: "No digest needed",
        message: "Your workspace queue is clear, so there is nothing to email right now.",
        tone: "success",
      })
      return
    }

    toastStore.push({
      title: response.delivered ? "Digest sent" : response.configured ? "Digest could not be sent" : "Email not configured",
      message: response.delivered
        ? `${response.unreadCount} unread workspace item${response.unreadCount === 1 ? "" : "s"} sent to your account email.`
        : response.configured
          ? "The server accepted the request, but the mail provider rejected delivery."
          : "The server will record digest attempts once SMTP or sendmail is configured.",
      tone: response.delivered ? "success" : "info",
    })
  }
  finally {
    digestPending.value = false
  }
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Inbox"
      title="Work the queue, not just the tools"
      description="This is the operating surface for structured intros, replies, proposal terms, signatures, and system updates that still need action."
    >
      <template #actions>
        <BaseBadge tone="accent">
          {{ inboxSnapshot?.actions.length || 0 }} live item{{ inboxSnapshot?.actions.length === 1 ? "" : "s" }}
        </BaseBadge>
      </template>
    </PageIntro>

    <div class="panel p-6">
      <div class="flex flex-wrap gap-3 items-start justify-between">
        <div class="max-w-2xl">
          <h2 class="text-xl font-semibold">
            Action queue
          </h2>
          <p class="muted text-sm leading-6 mt-2">
            Work these from top to bottom before opening more surface area. The order favors direct replies, explicit terms, and signatures over passive browsing.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <BaseButton variant="secondary" :disabled="digestPending || !hasInboxActions" @click="sendDigest">
            {{ digestPending ? "Sending..." : "Email digest" }}
          </BaseButton>
          <BaseButton variant="secondary" to="/app/discover">
            Find new fits
          </BaseButton>
        </div>
      </div>

      <div v-if="inboxSnapshot?.actions.length" class="surface-row-list mt-5">
        <NuxtLink
          v-for="item in inboxSnapshot.actions"
          :key="item.id"
          :to="item.href"
          class="surface-row block transition hover:-translate-y-0.5"
          @click="item.kind === 'notification' ? markNotificationRead(item.id.replace('notification:', '')) : undefined"
        >
          <div class="flex gap-3 items-start justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap gap-2 items-center">
                <p class="text-sm font-semibold">
                  {{ item.title }}
                </p>
                <BaseBadge :tone="item.badgeTone">
                  {{ item.badgeLabel }}
                </BaseBadge>
              </div>
              <p class="muted text-sm leading-6 mt-2">
                {{ item.summary }}
              </p>
            </div>
            <span class="muted text-xs whitespace-nowrap">
              {{ formatRelativeDate(item.createdAt) }}
            </span>
          </div>
        </NuxtLink>
      </div>

      <EmptyState
        v-else
        class="mt-6"
        icon="i-carbon-task"
        title="The queue is clear"
        description="There is nothing urgent on you right now. This is the moment to search deliberately or tighten one live relationship instead of opening too many threads."
      >
        <BaseButton to="/app/discover">
          Open discover
        </BaseButton>
      </EmptyState>
    </div>
  </div>
</template>
