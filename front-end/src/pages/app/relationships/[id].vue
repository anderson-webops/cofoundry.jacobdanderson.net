<script setup lang="ts">
import type { RelationshipSnapshot } from "~/shared/utils/relationships"
import { formatDate, formatRelativeDate } from "~/shared/utils/format"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Relationship workspace")

const route = useRoute()
const { authStore } = useCurrentMember()
const matchId = computed(() => String(route.params.id || ""))

const { data, error, pending, refresh } = await useAsyncData(
  `relationship:${matchId.value}`,
  () => $fetch<{ relationship: RelationshipSnapshot }>(`/api/relationships/${matchId.value}`),
)

const relationship = computed(() => data.value?.relationship || null)
const latestMessages = computed(() => [...(relationship.value?.latestMessages || [])].reverse())

function senderLabel(senderUserId: string | null) {
  if (!senderUserId)
    return "System"

  if (senderUserId === authStore.currentUser?.id)
    return "You"

  return relationship.value?.counterpartProfile.displayName || "Counterpart"
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Relationship"
      :title="relationship ? relationship.counterpartProfile.displayName : 'Relationship workspace'"
      description="One working surface for the conversation, trial sprint, proposals, agreement draft, and next action."
    >
      <template #actions>
        <BaseButton variant="secondary" :disabled="pending" @click="refresh">
          {{ pending ? "Refreshing..." : "Refresh" }}
        </BaseButton>
      </template>
    </PageIntro>

    <EmptyState
      v-if="error"
      icon="i-carbon-warning"
      title="Relationship unavailable"
      description="This relationship may have been removed, or your account may not be a participant."
    >
      <BaseButton to="/app/matches">
        Back to matches
      </BaseButton>
    </EmptyState>

    <template v-else-if="relationship">
      <div class="gap-5 grid xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
        <section class="gap-5 grid">
          <article class="panel p-6">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div>
                <h2 class="text-xl font-semibold">
                  Conversation
                </h2>
                <p class="muted text-sm leading-6 mt-2">
                  {{ relationship.unreadCount }} unread message{{ relationship.unreadCount === 1 ? "" : "s" }} in this relationship.
                </p>
              </div>
              <BaseButton :to="`/app/messages/${relationship.conversationId}`">
                Open messages
              </BaseButton>
            </div>

            <div class="surface-row-list mt-5">
              <article v-for="message in latestMessages" :key="message.id" class="surface-row">
                <div class="flex flex-wrap gap-2 items-center">
                  <p class="text-sm font-semibold">
                    {{ senderLabel(message.senderUserId) }}
                  </p>
                  <BaseBadge :tone="message.type === 'system' ? 'neutral' : 'accent'">
                    {{ message.type }}
                  </BaseBadge>
                </div>
                <p class="muted text-sm leading-6 mt-2">
                  {{ message.body }}
                </p>
                <p class="text-xs text-[var(--muted)] mt-3">
                  {{ formatRelativeDate(message.createdAt) }}
                </p>
              </article>
            </div>
          </article>

          <article class="panel p-6">
            <h2 class="text-xl font-semibold">
              Proposals and agreements
            </h2>
            <div class="surface-row-list mt-5">
              <NuxtLink v-for="proposal in relationship.activeProposals" :key="proposal.id" :to="`/app/proposals/${proposal.id}`" class="surface-row block">
                <div class="flex gap-3 items-start justify-between">
                  <div>
                    <p class="text-sm font-semibold">
                      {{ proposal.title }}
                    </p>
                    <p class="muted text-sm mt-2">
                      Updated {{ formatDate(proposal.updatedAt) }}
                    </p>
                  </div>
                  <BaseBadge tone="accent">
                    {{ proposal.status }}
                  </BaseBadge>
                </div>
              </NuxtLink>

              <NuxtLink v-for="contract in relationship.activeContracts" :key="contract.id" :to="`/app/contracts/${contract.id}`" class="surface-row block">
                <div class="flex gap-3 items-start justify-between">
                  <div>
                    <p class="text-sm font-semibold">
                      {{ contract.title }}
                    </p>
                    <p class="muted text-sm mt-2">
                      Updated {{ formatDate(contract.updatedAt) }}
                    </p>
                  </div>
                  <BaseBadge :tone="contract.status === 'signed' ? 'success' : 'accent'">
                    {{ contract.status }}
                  </BaseBadge>
                </div>
              </NuxtLink>

              <EmptyState
                v-if="!relationship.activeProposals.length && !relationship.activeContracts.length"
                icon="i-carbon-document"
                title="No written terms yet"
                description="Use the conversation to confirm fit before sending a proposal."
              />
            </div>
          </article>
        </section>

        <aside class="gap-5 grid content-start">
          <article class="panel p-6">
            <h2 class="text-lg font-semibold">
              Next action
            </h2>
            <div class="surface-row-list mt-4">
              <NuxtLink v-for="action in relationship.nextActions" :key="action.id" :to="action.href" class="surface-row block">
                <p class="text-sm font-semibold">
                  {{ action.label }}
                </p>
                <p class="muted text-sm leading-6 mt-2">
                  {{ action.summary }}
                </p>
              </NuxtLink>
            </div>
          </article>

          <TrialCollaborationCard
            v-if="relationship.trial"
            :trial="relationship.trial"
            :acknowledged="relationship.trial.acknowledgedByUserIds.includes(authStore.currentUser?.id || '')"
          />

          <article v-else class="panel p-6">
            <h2 class="text-lg font-semibold">
              Trial sprint
            </h2>
            <p class="muted text-sm leading-6 mt-3">
              No sprint has been attached yet. Start one from matches once both sides are ready to pressure-test the working relationship.
            </p>
            <BaseButton class="mt-4" variant="secondary" to="/app/matches">
              Open matches
            </BaseButton>
          </article>
        </aside>
      </div>
    </template>
  </div>
</template>
