<script setup lang="ts">
import type { ContractLegalReview, ContractVersion } from "~/shared/types/domain"
import { formatDate } from "~/shared/utils/format"
import { formatContractLegalReviewerType, formatContractLegalReviewScope, formatContractLegalReviewStatus } from "~/shared/utils/legal-reviews"

definePageMeta({ layout: false })
useHead({
  title: "Agreement legal review",
  meta: [
    { name: "robots", content: "noindex, nofollow" },
    { name: "referrer", content: "no-referrer" },
  ],
})

interface ReviewResponse {
  contract: { title: string }
  legalNotice: string
  review: Pick<ContractLegalReview, "createdAt" | "expiresAt" | "message" | "openedAt" | "respondedAt" | "respondedByName" | "reviewerName" | "reviewerOrganization" | "reviewerResponse" | "reviewerType" | "scope" | "status" | "updatedAt">
  version: Omit<ContractVersion, "contractId" | "generatedFromProposalVersionId" | "id">
}

const route = useRoute()
const token = computed(() => typeof route.params.token === "string"
  ? route.params.token
  : "")
const loading = ref(true)
const submitting = ref(false)
const data = ref<ReviewResponse | null>(null)
const errorMessage = ref("")
const responseStatus = ref<"approved" | "changes_requested">("changes_requested")
const response = ref("")
const responseError = ref("")
const respondedByName = ref("")
const authorityConfirmed = ref(false)
const respondedByNameError = ref("")
const authorityError = ref("")

async function loadReview() {
  if (!token.value) {
    errorMessage.value = "This legal review link is incomplete."
    loading.value = false
    return
  }

  try {
    data.value = await $fetch<ReviewResponse>(`/api/legal-reviews/${encodeURIComponent(token.value)}`)
    if (data.value.review.status === "requested") {
      const opened = await $fetch<{ review: ContractLegalReview }>(`/api/legal-reviews/${encodeURIComponent(token.value)}`, {
        body: { action: "open" },
        method: "POST",
      })
      data.value.review = opened.review
    }
  }
  catch (error: unknown) {
    const payload = error as { data?: { message?: string }, statusMessage?: string }
    errorMessage.value = payload.data?.message || payload.statusMessage || "This legal review is unavailable."
  }
  finally {
    loading.value = false
  }
}

async function submitResponse() {
  responseError.value = ""
  respondedByNameError.value = ""
  authorityError.value = ""
  if (respondedByName.value.trim().length < 2) {
    respondedByNameError.value = "Type your name as the person recording this response."
    return
  }
  if (!authorityConfirmed.value) {
    authorityError.value = "Confirm that you are authorized to respond for the named reviewer or organization."
    return
  }
  if (response.value.trim().length < 20) {
    responseError.value = "Provide enough detail for the parties to act on the review."
    return
  }

  submitting.value = true
  try {
    const result = await $fetch<{ review: ContractLegalReview }>(`/api/legal-reviews/${encodeURIComponent(token.value)}`, {
      body: {
        action: "respond",
        authorityConfirmed: true,
        response: response.value,
        respondedByName: respondedByName.value,
        status: responseStatus.value,
      },
      method: "POST",
    })
    if (data.value)
      data.value.review = result.review
    response.value = ""
  }
  catch (error: unknown) {
    const payload = error as { data?: { message?: string }, statusMessage?: string }
    responseError.value = payload.data?.message || payload.statusMessage || "The review response could not be recorded."
  }
  finally {
    submitting.value = false
  }
}

onMounted(loadReview)
</script>

<template>
  <div class="py-6 min-h-screen md:py-10">
    <div class="page-shell">
      <header class="mb-8 flex items-center justify-between">
        <AppLogo />
        <ThemeToggle />
      </header>

      <main>
        <div v-if="loading" class="panel p-8" role="status">
          <p class="font-semibold">
            Opening the agreement review...
          </p>
        </div>

        <div v-else-if="errorMessage" class="max-w-3xl">
          <PageIntro eyebrow="Legal review" title="This review link is unavailable." :description="errorMessage" />
          <div class="surface-row mt-6">
            <p class="muted text-sm leading-7">
              Ask the agreement participant who invited you to create a new version-bound review link.
            </p>
          </div>
        </div>

        <div v-else-if="data" class="gap-6 grid xl:grid-cols-[0.8fr_1.2fr]">
          <section class="gap-5 grid content-start">
            <PageIntro
              eyebrow="Agreement legal review"
              :title="data.contract.title"
              :description="`Version ${data.version.versionNumber} was shared with ${data.review.reviewerName} for a limited review response.`"
            />

            <div class="surface-row">
              <div class="flex flex-wrap gap-3 items-center justify-between">
                <div>
                  <p class="font-semibold">
                    {{ data.review.reviewerOrganization }}
                  </p>
                  <p class="muted text-sm mt-1">
                    {{ formatContractLegalReviewerType(data.review.reviewerType) }}
                  </p>
                </div>
                <BaseBadge :tone="data.review.status === 'approved' ? 'success' : data.review.status === 'changes_requested' ? 'warning' : 'accent'">
                  {{ formatContractLegalReviewStatus(data.review.status) }}
                </BaseBadge>
              </div>
              <p class="muted text-sm leading-7 mt-4">
                {{ data.review.message }}
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <BaseBadge v-for="scope in data.review.scope" :key="scope" tone="neutral">
                  {{ formatContractLegalReviewScope(scope) }}
                </BaseBadge>
              </div>
              <p class="muted text-xs leading-5 mt-4">
                Requested {{ formatDate(data.review.createdAt) }} · Link expires {{ formatDate(data.review.expiresAt) }}
              </p>
            </div>

            <div v-if="data.review.reviewerResponse" class="surface-row">
              <h2 class="font-semibold">
                Recorded response
              </h2>
              <p class="muted text-sm leading-7 mt-3 whitespace-pre-wrap">
                {{ data.review.reviewerResponse }}
              </p>
              <p v-if="data.review.respondedByName" class="muted text-xs leading-5 mt-3">
                Recorded by {{ data.review.respondedByName }}<template v-if="data.review.respondedAt">
                  on {{ formatDate(data.review.respondedAt) }}
                </template>.
              </p>
            </div>

            <form v-if="['requested', 'opened'].includes(data.review.status)" class="panel p-5 gap-4 grid" @submit.prevent="submitResponse">
              <h2 class="text-lg font-semibold">
                Record review outcome
              </h2>
              <TextInput
                v-model="respondedByName"
                label="Your name"
                :error="respondedByNameError"
                required
              />
              <SelectInput
                v-model="responseStatus"
                label="Outcome"
                :options="[
                  { label: 'Request changes', value: 'changes_requested' },
                  { label: 'Approve requested scope', value: 'approved' },
                ]"
              />
              <TextareaInput
                v-model="response"
                label="Review response"
                :rows="6"
                :error="responseError"
                helper="State the scope reviewed, any assumptions, and the exact changes or follow-up documents the parties need."
              />
              <label class="text-sm leading-6 p-4 border border-[var(--line)] rounded-2xl flex gap-3 items-start">
                <input v-model="authorityConfirmed" type="checkbox" class="mt-1">
                <span>I am the named reviewer or am authorized to respond for the named organization. I understand this records a workflow response, not a verified identity, license, engagement, or electronic signature.</span>
              </label>
              <p v-if="authorityError" class="field-error">
                {{ authorityError }}
              </p>
              <div class="flex justify-end">
                <BaseButton type="submit" :disabled="submitting">
                  {{ submitting ? "Recording..." : "Record response" }}
                </BaseButton>
              </div>
            </form>

            <p class="muted text-xs leading-6">
              {{ data.legalNotice }}
            </p>
          </section>

          <section class="panel p-6 md:p-8">
            <div class="flex flex-wrap gap-3 items-center justify-between">
              <p class="muted text-sm">
                Version {{ data.version.versionNumber }} · {{ formatDate(data.version.createdAt) }}
              </p>
              <BaseBadge tone="neutral">
                Version-bound copy
              </BaseBadge>
            </div>

            <div class="text-sm leading-7 mt-6 gap-5 grid">
              <div>
                <h2 class="font-semibold">
                  Parties
                </h2>
                <p class="muted mt-2">
                  {{ data.version.parties.join(" and ") }}
                </p>
              </div>
              <div>
                <h2 class="font-semibold">
                  Role and scope
                </h2>
                <p class="muted mt-2">
                  {{ data.version.roleTitle }}
                </p>
                <p class="muted mt-2 whitespace-pre-wrap">
                  {{ data.version.scope }}
                </p>
              </div>
              <div>
                <h2 class="font-semibold">
                  Time commitment
                </h2>
                <p class="muted mt-2 whitespace-pre-wrap">
                  {{ data.version.timeCommitment }}
                </p>
              </div>
              <div class="gap-4 grid md:grid-cols-2">
                <div class="panel-inset p-4">
                  <p class="font-semibold">
                    Compensation
                  </p>
                  <p class="muted mt-2 whitespace-pre-wrap">
                    {{ data.version.compensation }}
                  </p>
                </div>
                <div class="panel-inset p-4">
                  <p class="font-semibold">
                    Equity
                  </p>
                  <p class="muted mt-2 whitespace-pre-wrap">
                    {{ data.version.equity }}
                  </p>
                </div>
              </div>
              <div>
                <h2 class="font-semibold">
                  Vesting and cliff
                </h2>
                <p class="muted mt-2 whitespace-pre-wrap">
                  {{ data.version.vesting }}
                </p>
              </div>
              <div>
                <h2 class="font-semibold">
                  IP assignment
                </h2>
                <p class="muted mt-2 whitespace-pre-wrap">
                  {{ data.version.ipAssignment }}
                </p>
              </div>
              <div>
                <h2 class="font-semibold">
                  Confidentiality
                </h2>
                <p class="muted mt-2 whitespace-pre-wrap">
                  {{ data.version.confidentiality }}
                </p>
              </div>
              <div>
                <h2 class="font-semibold">
                  Decision-making
                </h2>
                <p class="muted mt-2 whitespace-pre-wrap">
                  {{ data.version.decisionMaking }}
                </p>
              </div>
              <div>
                <h2 class="font-semibold">
                  Termination and disputes
                </h2>
                <p class="muted mt-2 whitespace-pre-wrap">
                  {{ data.version.termination }}
                </p>
                <p class="muted mt-2 whitespace-pre-wrap">
                  {{ data.version.disputeResolution }}
                </p>
              </div>
              <div class="panel-inset p-4">
                <p class="font-semibold">
                  Notes
                </p>
                <p class="muted mt-2 whitespace-pre-wrap">
                  {{ data.version.notes }}
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  </div>
</template>
