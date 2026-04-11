<script setup lang="ts">
import { commitmentOptions, industryOptions, remoteOptions, roleOptions, stageOptions } from "~/shared/constants/options"
import { opportunitySchema } from "~/shared/utils/validation"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Opportunities")

const toastStore = useToastStore()
const { authStore, workspaceStore } = useCurrentMember()

const dialogOpen = ref(false)
const errors = ref<Record<string, string>>({})
const form = reactive({
  startupName: "",
  oneLinePitch: "",
  problem: "",
  targetUsers: "",
  stage: "idea",
  traction: "",
  rolesNeeded: [] as string[],
  expectedCommitment: "full_time",
  compensationStructure: "cash_and_equity",
  equityRange: "",
  location: "",
  remotePreference: "remote",
  industries: [] as string[],
})

async function createOpportunityPost() {
  errors.value = {}
  const parsed = opportunitySchema.safeParse(form)
  if (!parsed.success) {
    errors.value = Object.fromEntries(parsed.error.issues.map(issue => [issue.path[0] as string, issue.message]))
    return
  }

  if (!authStore.currentUser)
    return

  workspaceStore.createOpportunity(authStore.currentUser.id, parsed.data)
  toastStore.push({
    title: "Opportunity published",
    message: "Your startup opportunity is now visible in discovery.",
    tone: "success",
  })
  dialogOpen.value = false
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Startup opportunities"
      title="Founders can publish exactly what kind of partner they need."
      description="Opportunity posts carry the startup context, role scope, stage, traction, commitment, and compensation structure that collaborators need to evaluate fit."
    >
      <template #actions>
        <BaseButton @click="dialogOpen = true">
          New opportunity
        </BaseButton>
      </template>
    </PageIntro>

    <div class="gap-4 grid lg:grid-cols-2 xl:grid-cols-3">
      <OpportunityCard
        v-for="opportunity in workspaceStore.data.opportunities"
        :key="opportunity.id"
        :opportunity="opportunity"
      >
        <BaseButton variant="secondary" :to="`/app/opportunities/${opportunity.id}`">
          View details
        </BaseButton>
      </OpportunityCard>
    </div>

    <BaseDialog v-model="dialogOpen" title="Create startup opportunity" description="This appears in discovery and tells collaborators what kind of role and ownership structure you are looking for.">
      <form class="gap-4 grid" @submit.prevent="createOpportunityPost">
        <TextInput v-model="form.startupName" label="Startup name" :error="errors.startupName" />
        <TextInput v-model="form.oneLinePitch" label="One-line pitch" :error="errors.oneLinePitch" />
        <TextareaInput v-model="form.problem" label="Problem" :error="errors.problem" rows="4" />
        <TextareaInput v-model="form.targetUsers" label="Target users" :error="errors.targetUsers" rows="3" />
        <div class="gap-4 grid md:grid-cols-2">
          <SelectInput v-model="form.stage" label="Stage" :options="stageOptions" :error="errors.stage" />
          <SelectInput v-model="form.expectedCommitment" label="Expected commitment" :options="commitmentOptions" :error="errors.expectedCommitment" />
        </div>
        <TextareaInput v-model="form.traction" label="Traction" :error="errors.traction" rows="3" />
        <PillPicker v-model="form.rolesNeeded" label="Roles needed" :options="roleOptions" />
        <PillPicker v-model="form.industries" label="Industries" :options="industryOptions" />
        <div class="gap-4 grid md:grid-cols-2">
          <TextInput v-model="form.equityRange" label="Equity range" :error="errors.equityRange" />
          <TextInput v-model="form.location" label="Location" :error="errors.location" />
        </div>
        <SelectInput v-model="form.remotePreference" label="Remote preference" :options="remoteOptions" :error="errors.remotePreference" />
        <div class="gap-2 grid">
          <span class="field-label">Compensation structure</span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in ['equity_only', 'cash_and_equity', 'cash_only', 'advisory']"
              :key="option"
              type="button"
              class="pill"
              :class="form.compensationStructure === option ? 'pill-active' : ''"
              @click="form.compensationStructure = option"
            >
              {{ option.replaceAll('_', ' ') }}
            </button>
          </div>
        </div>
        <div class="flex justify-end">
          <BaseButton type="submit">
            Publish opportunity
          </BaseButton>
        </div>
      </form>
    </BaseDialog>
  </div>
</template>
