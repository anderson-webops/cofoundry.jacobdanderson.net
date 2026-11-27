<script setup lang="ts">
import { computed } from "vue"
import { definePageMeta } from "#app/composables/pages"
import BaseButton from "~/components/ui/BaseButton.vue"
import EmptyState from "~/components/ui/EmptyState.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { useCurrentMember } from "~/composables/useCurrentMember"
import { usePageSeo } from "~/composables/usePageSeo"
import { getContractsForUser, getCurrentContractVersion } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Legal review")

const { authStore, workspaceStore } = useCurrentMember()
const contracts = computed(() => authStore.currentUser
  ? getContractsForUser(workspaceStore.data, authStore.currentUser.id)
  : [])
</script>

<template>
  <div class="gap-8 grid">
    <PageIntro
      eyebrow="Legal review"
      title="Bring the right legal representative into the agreement."
      description="Invite your organization's counsel or an independent attorney to review one exact agreement version, then keep their approval or requested changes with the negotiation record."
    />

    <section class="gap-4 grid lg:grid-cols-2">
      <div class="surface-row">
        <div class="flex gap-3 items-center">
          <span class="i-carbon-enterprise text-xl text-[var(--accent)]" />
          <h2 class="text-lg font-semibold">
            In-house or team counsel
          </h2>
        </div>
        <p class="muted text-sm leading-7 mt-3">
          Send a version-bound invite to a lawyer employed by your company, studio, fund, or parent organization. Their engagement and duties remain with your organization.
        </p>
      </div>

      <div class="surface-row">
        <div class="flex gap-3 items-center">
          <span class="i-carbon-collaborate text-xl text-[var(--accent)]" />
          <h2 class="text-lg font-semibold">
            Outside counsel
          </h2>
        </div>
        <p class="muted text-sm leading-7 mt-3">
          Invite an attorney or firm you retain independently. CoFoundry does not participate in selection, engagement, fees, conflicts checks, or legal advice.
        </p>
      </div>
    </section>

    <section>
      <div class="flex flex-wrap gap-4 items-end justify-between">
        <div>
          <p class="section-kicker">
            Agreement handoff
          </p>
          <h2 class="text-2xl font-semibold mt-2">
            Choose an agreement to review.
          </h2>
        </div>
        <BaseButton variant="secondary" to="/app/contracts">
          Open all agreements
        </BaseButton>
      </div>

      <div v-if="contracts.length" class="surface-row-list mt-5">
        <div v-for="contract in contracts" :key="contract.id" class="surface-row flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-semibold">
              {{ contract.title }}
            </p>
            <p class="muted text-sm mt-1">
              Version {{ getCurrentContractVersion(workspaceStore.data, contract)?.versionNumber || "-" }} · {{ contract.status.replaceAll("_", " ") }}
            </p>
          </div>
          <BaseButton :to="`/app/contracts/${contract.id}`">
            Open review workflow
          </BaseButton>
        </div>
      </div>

      <EmptyState
        v-else
        class="mt-5"
        icon="i-carbon-license-global"
        title="No agreement drafts yet"
        description="Accept a proposal and generate an agreement before inviting counsel."
      >
        <BaseButton to="/app/proposals">
          Review proposals
        </BaseButton>
      </EmptyState>
    </section>

    <section class="gap-5 grid lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <p class="section-kicker">
          Find independent help
        </p>
        <h2 class="text-2xl font-semibold mt-2">
          Start with a bar-association referral service.
        </h2>
        <p class="muted text-sm leading-7 mt-4">
          CoFoundry does not rank or endorse lawyers. These independent American Bar Association resources can help you find state and local referral programs and verify licensing.
        </p>
        <p class="muted text-sm leading-7 mt-3">
          CoFoundry does not verify the identity, license, conflicts, authority, or engagement status of a person invited through the agreement workflow. Confirm those matters directly before relying on a response.
        </p>
      </div>

      <div class="surface-row-list">
        <a
          href="https://www.americanbar.org/groups/lawyer_referral/resources/lawyer-referral-directory/"
          target="_blank"
          rel="noopener noreferrer"
          class="surface-row flex gap-4 items-center justify-between"
        >
          <span>
            <span class="font-semibold block">ABA lawyer referral directory</span>
            <span class="muted text-sm leading-6 mt-1 block">Search state and local bar-association referral services.</span>
          </span>
          <span class="i-carbon-launch" aria-hidden="true" />
        </a>
        <a
          href="https://www.americanbar.org/groups/legal_services/flh-home/"
          target="_blank"
          rel="noopener noreferrer"
          class="surface-row flex gap-4 items-center justify-between"
        >
          <span>
            <span class="font-semibold block">ABA Find Legal Help</span>
            <span class="muted text-sm leading-6 mt-1 block">Review referral, licensing, and lower-cost legal-help resources.</span>
          </span>
          <span class="i-carbon-launch" aria-hidden="true" />
        </a>
        <div class="surface-row flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-semibold">
              Need help with the handoff?
            </p>
            <p class="muted text-sm leading-6 mt-1">
              Contact CoFoundry support for product and document-sharing help, not legal advice or lawyer selection.
            </p>
          </div>
          <BaseButton variant="secondary" to="/contact?topic=legal-review">
            Contact support
          </BaseButton>
        </div>
      </div>
    </section>
  </div>
</template>
