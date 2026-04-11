<script setup lang="ts">
import type { ReportReason } from "~/shared/types/domain"
import { reportReasonOptions } from "~/shared/constants/options"
import { reportSchema } from "~/shared/utils/validation"

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
const form = reactive({
  reason: "spam" as ReportReason,
  details: "",
})

watch(isOpen, (open) => {
  if (open)
    errors.value = {}
})

function submitReport() {
  errors.value = {}
  const parsed = reportSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = Object.fromEntries(parsed.error.issues.map(issue => [issue.path[0] as string, issue.message]))
    return
  }

  if (!authStore.currentUser)
    return

  workspaceStore.createReport(
    authStore.currentUser.id,
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
      <div class="flex justify-end">
        <BaseButton type="submit">
          Submit report
        </BaseButton>
      </div>
    </form>
  </BaseDialog>
</template>
