<script setup lang="ts">
import type { ContractLegalReviewerType, ContractLegalReviewScope } from "~/shared/types/domain"
import { reactive, ref } from "vue"
import SelectInput from "~/components/forms/SelectInput.vue"
import TextareaInput from "~/components/forms/TextareaInput.vue"
import TextInput from "~/components/forms/TextInput.vue"
import BaseButton from "~/components/ui/BaseButton.vue"
import { contractLegalReviewerTypeOptions, contractLegalReviewScopeOptions } from "~/shared/utils/legal-reviews"
import { contractLegalReviewRequestSchema } from "~/shared/utils/validation"

withDefaults(defineProps<{
  submitting?: boolean
}>(), {
  submitting: false,
})

const emit = defineEmits<{
  submitted: [payload: {
    message: string
    reviewerEmail: string
    reviewerName: string
    reviewerOrganization: string
    reviewerType: ContractLegalReviewerType
    scope: ContractLegalReviewScope[]
    shareAuthorized: true
  }]
}>()

const form = reactive({
  message: "Please review the selected areas and flag any jurisdiction-specific documents, approvals, or revisions we should complete before signing.",
  reviewerEmail: "",
  reviewerName: "",
  reviewerOrganization: "",
  reviewerType: "outside_counsel" as ContractLegalReviewerType,
  scope: ["full_agreement"] as ContractLegalReviewScope[],
  shareAuthorized: false,
})
const errors = ref<Record<string, string>>({})

function toggleScope(scope: ContractLegalReviewScope) {
  form.scope = form.scope.includes(scope)
    ? form.scope.filter(item => item !== scope)
    : [...form.scope, scope]
}

function submitForm() {
  errors.value = {}
  const parsed = contractLegalReviewRequestSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = Object.fromEntries(parsed.error.issues.map(issue => [
      String(issue.path[0] || "form"),
      issue.message
    ]))
    return
  }

  emit("submitted", {
    message: parsed.data.message,
    reviewerEmail: parsed.data.reviewerEmail,
    reviewerName: parsed.data.reviewerName,
    reviewerOrganization: parsed.data.reviewerOrganization,
    reviewerType: parsed.data.reviewerType,
    scope: parsed.data.scope,
    shareAuthorized: true,
  })
}
</script>

<template>
  <form class="gap-5 grid" @submit.prevent="submitForm">
    <SelectInput
      v-model="form.reviewerType"
      label="Reviewer relationship"
      :options="contractLegalReviewerTypeOptions"
      :error="errors.reviewerType"
      helper="Choose in-house for counsel employed by your organization or team; choose outside counsel for an independent firm or attorney."
    />

    <div class="gap-4 grid md:grid-cols-2">
      <TextInput v-model="form.reviewerName" label="Reviewer name" :error="errors.reviewerName" required />
      <TextInput v-model="form.reviewerEmail" label="Reviewer email" type="email" :error="errors.reviewerEmail" required />
    </div>
    <TextInput
      v-model="form.reviewerOrganization"
      label="Organization or firm"
      :error="errors.reviewerOrganization"
      required
    />

    <fieldset>
      <legend class="field-label">
        Review scope
      </legend>
      <div class="gap-2 grid sm:grid-cols-2">
        <label
          v-for="option in contractLegalReviewScopeOptions"
          :key="option.value"
          class="text-sm px-3 py-2.5 border border-[var(--line)] rounded-2xl flex gap-3 items-center"
        >
          <input
            type="checkbox"
            :checked="form.scope.includes(option.value)"
            @change="toggleScope(option.value)"
          >
          <span>{{ option.label }}</span>
        </label>
      </div>
      <p v-if="errors.scope" class="field-error">
        {{ errors.scope }}
      </p>
    </fieldset>

    <TextareaInput
      v-model="form.message"
      label="Context for the reviewer"
      :rows="4"
      :error="errors.message"
    />

    <label class="text-sm leading-6 p-4 border border-[var(--line)] rounded-2xl flex gap-3 items-start">
      <input v-model="form.shareAuthorized" type="checkbox" class="mt-1">
      <span>I am authorized to share this agreement version and its terms with the named reviewer. I understand the invite is a confidential bearer link.</span>
    </label>
    <p v-if="errors.shareAuthorized" class="field-error">
      {{ errors.shareAuthorized }}
    </p>

    <div class="flex flex-wrap gap-3 items-center justify-between">
      <p class="muted text-xs leading-5 max-w-md">
        CoFoundry transmits the document and response. It does not select counsel, provide legal advice, or create an attorney-client relationship.
      </p>
      <BaseButton type="submit" :disabled="submitting">
        {{ submitting ? "Preparing invite..." : "Request legal review" }}
      </BaseButton>
    </div>
  </form>
</template>
