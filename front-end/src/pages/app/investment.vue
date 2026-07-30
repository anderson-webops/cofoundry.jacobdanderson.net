<script setup lang="ts">
definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Investment")

const investmentEnabled = useFeatureFlag("featureInvestmentModule")
const toastStore = useToastStore()
const { authStore, workspaceStore } = useCurrentMember()

const form = reactive({
  opportunityId: "",
  raiseAmount: "",
  traction: "",
  deckLink: "",
  teamSummary: "",
  reason: "",
})
const pending = ref(false)
const formError = ref("")

async function submitApplication() {
  if (!authStore.currentUser || !form.opportunityId)
    return

  pending.value = true
  formError.value = ""
  try {
    await workspaceStore.createInvestmentApplication(form.opportunityId, {
      raiseAmount: form.raiseAmount,
      traction: form.traction,
      deckLink: form.deckLink,
      teamSummary: form.teamSummary,
      reason: form.reason,
    })
    toastStore.push({
      title: "Application submitted",
      message: "The investment application was added to the review queue.",
      tone: "success",
    })
  }
  catch (caughtError) {
    formError.value = caughtError instanceof Error ? caughtError.message : "The application could not be submitted."
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Investment"
      title="Future investment module"
      description="This module is intentionally separated from the paid SaaS product. It is disabled by default and does not imply automatic platform equity."
    />

    <EmptyState
      v-if="!investmentEnabled"
      icon="i-carbon-currency"
      title="Investment module disabled"
      description="The UI scaffold and data model exist, but this workspace keeps the investment flow turned off by default."
    />

    <template v-else>
      <div class="gap-6 grid xl:grid-cols-[0.9fr_1.1fr]">
        <div class="panel p-6">
          <h2 class="text-lg font-semibold">
            Apply for platform investment
          </h2>
          <form class="mt-5 gap-4 grid" @submit.prevent="submitApplication">
            <SelectInput
              v-model="form.opportunityId"
              label="Startup opportunity"
              :options="workspaceStore.data.opportunities.filter(item => item.ownerUserId === authStore.currentUser?.id).map(item => ({ label: item.startupName, value: item.id }))"
            />
            <TextInput v-model="form.raiseAmount" label="Raise amount" />
            <TextareaInput v-model="form.traction" label="Traction" :rows="4" />
            <TextInput v-model="form.deckLink" label="Deck link" />
            <TextareaInput v-model="form.teamSummary" label="Team summary" :rows="3" />
            <TextareaInput v-model="form.reason" label="Why do you want investment?" :rows="4" />
            <p v-if="formError" class="field-error">
              {{ formError }}
            </p>
            <div class="flex justify-end">
              <BaseButton type="submit" :disabled="pending">
                {{ pending ? "Submitting..." : "Submit application" }}
              </BaseButton>
            </div>
          </form>
        </div>

        <div class="gap-4 grid">
          <article v-for="application in workspaceStore.data.investmentApplications" :key="application.id" class="panel p-6">
            <div class="flex gap-4 items-start justify-between">
              <div>
                <h2 class="text-lg font-semibold">
                  {{ workspaceStore.data.opportunities.find(item => item.id === application.opportunityId)?.startupName }}
                </h2>
                <p class="muted text-sm leading-6 mt-2">
                  {{ application.teamSummary }}
                </p>
              </div>
              <BaseBadge tone="accent">
                {{ application.status }}
              </BaseBadge>
            </div>
            <div class="muted text-sm mt-5 gap-2 grid">
              <div>Raise: {{ application.raiseAmount }}</div>
              <div>Traction: {{ application.traction }}</div>
            </div>
          </article>
        </div>
      </div>
    </template>
  </div>
</template>
