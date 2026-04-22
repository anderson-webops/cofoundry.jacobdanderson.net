<script setup lang="ts">
import type { Profile } from "~/shared/types/domain"
import { buildProfileReadiness } from "~/shared/utils/formation"

const props = defineProps<{
  profile: Profile
  previewCount: number
  matchCount: number
  proposalCount: number
}>()

const readiness = computed(() => buildProfileReadiness(props.profile))

const activationTasks = computed(() => [
  {
    id: "preview",
    title: "Review your match preview",
    complete: props.previewCount > 0,
    description: props.previewCount > 0 ? `${props.previewCount} relevant people or opportunities are already ranked for you.` : "Tighten your profile signal so the first preview is worth acting on.",
    ctaLabel: "Open discover",
    href: "/app/discover",
  },
  {
    id: "outreach",
    title: "Unlock first outreach",
    complete: readiness.value.readyForOutreach,
    description: readiness.value.readyForOutreach ? "You can send connect requests now." : `Still missing ${readiness.value.missingOutreachItems.join(", ")}.`,
    ctaLabel: "Finish profile",
    href: "/app/profile/edit",
  },
  {
    id: "match",
    title: "Move one match into a trial sprint",
    complete: props.matchCount > 0,
    description: props.matchCount > 0 ? `${props.matchCount} mutual match${props.matchCount === 1 ? "" : "es"} can move into a working sprint.` : "Mutual interest unlocks messaging and a short trial sprint.",
    ctaLabel: "Open matches",
    href: "/app/matches",
  },
  {
    id: "proposal",
    title: "Convert a conversation into a proposal",
    complete: props.proposalCount > 0,
    description: props.proposalCount > 0 ? `${props.proposalCount} proposal${props.proposalCount === 1 ? "" : "s"} already exist in your account.` : "Open a proposal once the role, commitment, and guardrails are clear.",
    ctaLabel: "Open proposals",
    href: "/app/proposals",
  },
])
</script>

<template>
  <div class="panel p-5">
    <div class="flex gap-4 items-start justify-between">
      <div>
        <h2 class="text-lg font-semibold">
          First-week activation
        </h2>
        <p class="muted text-sm leading-6 mt-2">
          Get the profile in shape, then move one conversation forward.
        </p>
      </div>
      <BaseBadge :tone="readiness.profileComplete ? 'success' : 'accent'">
        {{ readiness.percent }}%
      </BaseBadge>
    </div>

    <div class="mt-5">
      <div class="rounded-full bg-[var(--panel-inset)] h-2 overflow-hidden">
        <div class="rounded-full bg-[var(--accent)] h-full transition-all duration-300" :style="{ width: `${readiness.percent}%` }" />
      </div>
      <p class="muted text-sm leading-6 mt-3">
        {{ readiness.completedCount }} of {{ readiness.totalCount }} profile signals completed.
      </p>
    </div>

    <div class="surface-row-list mt-5">
      <div
        v-for="task in activationTasks"
        :key="task.id"
        class="surface-row flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
      >
        <div>
          <p class="text-sm font-semibold">
            {{ task.title }}
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ task.description }}
          </p>
        </div>
        <div class="flex gap-2 items-center md:flex-col md:items-end">
          <BaseBadge :tone="task.complete ? 'success' : 'warning'">
            {{ task.complete ? "Done" : "Next" }}
          </BaseBadge>
          <BaseButton variant="ghost" size="sm" :to="task.href">
            {{ task.ctaLabel }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>
