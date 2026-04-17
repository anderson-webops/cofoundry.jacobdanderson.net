<script setup lang="ts">
import type { StructuredIntro } from "~/shared/types/domain"
import { buildSubscriptionUsage, formatUsageQuota } from "~/shared/utils/billing"
import { formatCommitment, formatCompensation, formatContactRevealStage, formatOpportunityVerificationStatus, formatRemotePreference, formatStage } from "~/shared/utils/format"
import { getOpportunityVerificationTone, getOutreachUnlockMessage } from "~/shared/utils/formation"
import { getProfileByUserId } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

const route = useRoute()
const toastStore = useToastStore()
const { authStore, subscription, workspaceStore } = useCurrentMember()
const reportDialogOpen = ref(false)
const introDialogOpen = ref(false)

const opportunity = computed(() => workspaceStore.data.opportunities.find(item => item.id === route.params.id))
const ownerProfile = computed(() => opportunity.value ? getProfileByUserId(workspaceStore.data, opportunity.value.ownerUserId) : null)
const roles = computed(() => workspaceStore.data.opportunityRoles.filter(role => role.opportunityId === route.params.id))
const currentProfile = computed(() => authStore.currentUser ? getProfileByUserId(workspaceStore.data, authStore.currentUser.id) : null)
const usage = computed(() => authStore.currentUser ? buildSubscriptionUsage(workspaceStore.data, authStore.currentUser.id, subscription.value || undefined) : null)

usePageSeo("Opportunity details")

async function expressInterest(payload: { note: string, structuredIntro: StructuredIntro }) {
  if (!authStore.currentUser || !opportunity.value)
    return

  const sent = await workspaceStore.sendConnectRequest(
    authStore.currentUser.id,
    opportunity.value.ownerUserId,
    payload,
  )
  if (!sent) {
    toastStore.push({
      title: "Verification needed",
      message: currentProfile.value ? getOutreachUnlockMessage(currentProfile.value) : "Finish your profile and phone verification before sending outreach requests.",
      tone: "warning",
    })
    return
  }

  toastStore.push({
    title: "Structured intro sent",
    message: "The founder will see your intro and can accept to unlock messaging around the proposed next step.",
    tone: "success",
  })
  introDialogOpen.value = false
}

function onReportCreated() {
  toastStore.push({
    title: "Report submitted",
    message: "The listing was added to the moderation queue with its recent safety context attached.",
    tone: "success",
  })
}
</script>

<template>
  <div>
    <div v-if="opportunity" class="gap-6 grid">
      <PageIntro
        eyebrow="Opportunity"
        :title="opportunity.startupName"
        :description="opportunity.oneLinePitch"
      >
        <template #actions>
          <BaseButton variant="ghost" @click="reportDialogOpen = true">
            Report
          </BaseButton>
          <BaseButton variant="secondary" @click="workspaceStore.toggleBookmark(authStore.currentUser!.id, 'opportunity', opportunity.id)">
            Save opportunity
          </BaseButton>
          <BaseButton v-if="authStore.currentUser?.id !== opportunity.ownerUserId" @click="introDialogOpen = true">
            Send structured intro
          </BaseButton>
        </template>
      </PageIntro>

      <div class="gap-6 grid xl:grid-cols-[1.1fr_0.9fr]">
        <section class="panel p-6">
          <div class="flex flex-wrap gap-2">
            <BaseBadge tone="accent">
              {{ formatStage(opportunity.stage) }}
            </BaseBadge>
            <BaseBadge tone="neutral">
              {{ formatRemotePreference(opportunity.remotePreference) }}
            </BaseBadge>
            <BaseBadge tone="neutral">
              {{ formatCommitment(opportunity.expectedCommitment) }}
            </BaseBadge>
            <BaseBadge tone="neutral">
              {{ formatCompensation(opportunity.compensationStructure) }}
            </BaseBadge>
            <BaseBadge :tone="getOpportunityVerificationTone(opportunity.verificationStatus)">
              {{ formatOpportunityVerificationStatus(opportunity.verificationStatus) }}
            </BaseBadge>
          </div>

          <div class="mt-6 gap-6 grid">
            <div>
              <h2 class="text-lg font-semibold">
                Problem
              </h2>
              <p class="muted text-sm leading-7 mt-3">
                {{ opportunity.problem }}
              </p>
            </div>
            <div>
              <h2 class="text-lg font-semibold">
                Target users
              </h2>
              <p class="muted text-sm leading-7 mt-3">
                {{ opportunity.targetUsers }}
              </p>
            </div>
            <div>
              <h2 class="text-lg font-semibold">
                Traction
              </h2>
              <p class="muted text-sm leading-7 mt-3">
                {{ opportunity.traction }}
              </p>
            </div>
            <SafetyFlagsPanel :flags="opportunity.riskFlags" title="Listing review notice" />
          </div>
        </section>

        <section class="gap-4 grid">
          <div class="panel p-6">
            <h2 class="text-lg font-semibold">
              Founder
            </h2>
            <p class="text-sm font-semibold mt-3">
              {{ ownerProfile?.displayName }}
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ ownerProfile?.headline }}
            </p>
            <div v-if="ownerProfile" class="mt-4">
              <TrustSignalStrip :profile="ownerProfile" />
            </div>
            <div class="muted text-sm leading-6 mt-4 gap-2 grid">
              <div>Listing verification: {{ formatOpportunityVerificationStatus(opportunity.verificationStatus) }}</div>
              <div v-if="opportunity.officialWebsite">
                Official website: <a :href="opportunity.officialWebsite" target="_blank" class="underline underline-offset-4">{{ opportunity.officialWebsite }}</a>
              </div>
              <div>
                Contact reveal rule: {{ ownerProfile ? formatContactRevealStage(ownerProfile.privacy.contactRevealStage) : "After a mutual match" }}
              </div>
            </div>
          </div>

          <div class="panel p-6">
            <h2 class="text-lg font-semibold">
              Roles needed
            </h2>
            <div class="mt-4 gap-4 grid">
              <div v-for="role in roles" :key="role.id" class="panel-inset p-4">
                <p class="font-semibold">
                  {{ role.title }}
                </p>
                <p class="muted text-sm leading-6 mt-2">
                  {{ role.summary }}
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span v-for="skill in role.skills" :key="skill" class="pill">
                    {{ skill }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <EmptyState
      v-else
      icon="i-carbon-launch"
      title="Opportunity not found"
      description="The opportunity may have been removed or the route is incorrect."
    >
      <BaseButton to="/app/opportunities">
        Back to opportunities
      </BaseButton>
    </EmptyState>

    <ReportIssueDialog
      v-model="reportDialogOpen"
      title="Report startup opportunity"
      target-type="opportunity"
      :target-id="opportunity?.id || ''"
      :subject-label="opportunity?.startupName || 'this opportunity'"
      description="Use this if the listing feels fraudulent, misleading, or pushes unsafe off-platform behavior."
      @created="onReportCreated"
    />
    <StructuredIntroDialog
      v-model="introDialogOpen"
      context="opportunity"
      :target-label="opportunity?.startupName || 'this opportunity'"
      :default-role-context="roles[0]?.title || opportunity?.rolesNeeded[0] || opportunity?.startupName || 'Founding role'"
      :unlock-copy="currentProfile ? getOutreachUnlockMessage(currentProfile) : 'Outreach is gated behind baseline trust checks.'"
      :quota-copy="usage ? `This plan has ${formatUsageQuota(usage.intros)} this month.` : ''"
      @submit="expressInterest"
    />
  </div>
</template>
