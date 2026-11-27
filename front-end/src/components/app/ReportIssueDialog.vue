<script setup lang="ts">
import type { ReportReason } from "~/shared/types/domain"
import { reactive, ref, watch } from "vue"
import SelectInput from "~/components/forms/SelectInput.vue"
import TextareaInput from "~/components/forms/TextareaInput.vue"
import BaseButton from "~/components/ui/BaseButton.vue"
import BaseDialog from "~/components/ui/BaseDialog.vue"
import { reportReasonOptions } from "~/shared/constants/options"
import { reportSchema } from "~/shared/utils/validation"
import { useAuthStore } from "~/stores/auth"
import { useWorkspaceStore } from "~/stores/workspace"

const props = defineProps<{
  title: string
  targetType: "profile" | "message" | "opportunity"
  targetId: string
  subjectLabel: string
  description?: string
}>()

const emit = defineEmits<{
  created: [ReportReason]
}>()

const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()
const isOpen = defineModel<boolean>({ default: false })
const errors = ref<Record<string, string>>({})
const pending = ref(false)
const form = reactive({
  reason: "spam" as ReportReason,
  details: "",
})

watch(isOpen, (open) => {
  if (open)
    errors.value = {}
})

async function submitReport() {
  errors.value = {}
  const parsed = reportSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = Object.fromEntries(parsed.error.issues.map(issue => [issue.path[0] as string, issue.message]))
    return
  }

  if (!authStore.currentUser)
    return

  pending.value = true
  try {
    await workspaceStore.createReport(
      props.targetType,
      props.targetId,
      parsed.data.reason,
      `${props.subjectLabel}: ${parsed.data.details}`,
    )
    emit("created", parsed.data.reason)
    form.reason = "spam"
    form.details = ""
    isOpen.value = false
  }
  catch (caughtError) {
    errors.value.form = caughtError instanceof Error
      ? caughtError.message
      : "The report could not be submitted."
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <BaseDialog v-model="isOpen" :title="title" :description="description || `Report ${subjectLabel} for moderation review.`">
    <form class="gap-4 grid" @submit.prevent="submitReport">
      <SelectInput
        v-model="form.reason"
        label="Reason"
        :options="reportReasonOptions"
        helper="High-priority reasons like impersonation or scam reports are escalated automatically."
        :error="errors.reason"
      />
      <TextareaInput
        v-model="form.details"
        label="Details"
        :rows="5"
        helper="Include what happened, where it happened, and why it felt unsafe or misleading."
        :error="errors.details"
      />
      <p v-if="errors.form" class="field-error">
        {{ errors.form }}
      </p>
      <div class="flex justify-end">
        <BaseButton type="submit" :disabled="pending">
          {{ pending ? "Submitting..." : "Submit report" }}
        </BaseButton>
      </div>
    </form>
  </BaseDialog>
</template>
