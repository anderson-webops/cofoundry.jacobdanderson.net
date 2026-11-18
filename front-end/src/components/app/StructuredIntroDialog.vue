<script setup lang="ts">
import type { ConnectRequestNextStep, StructuredIntro } from "~/shared/types/domain"
import { computed, reactive, watch } from "vue"
import SelectInput from "~/components/forms/SelectInput.vue"
import TextareaInput from "~/components/forms/TextareaInput.vue"
import TextInput from "~/components/forms/TextInput.vue"
import BaseButton from "~/components/ui/BaseButton.vue"
import BaseDialog from "~/components/ui/BaseDialog.vue"
import { connectRequestNextStepOptions } from "~/shared/constants/options"
import { buildStructuredIntroNote } from "~/shared/utils/formation"

const props = withDefaults(defineProps<{
  context?: "profile" | "opportunity"
  title?: string
  description?: string
  targetLabel: string
  defaultRoleContext?: string
  unlockCopy?: string
  quotaCopy?: string
}>(), {
  context: "profile",
  title: "Send structured intro",
  description: "Direct contact stays hidden until the other side accepts. Lead with fit, urgency, and a concrete next step.",
  defaultRoleContext: "",
  unlockCopy: "",
  quotaCopy: "",
})

const emit = defineEmits<{
  submit: [payload: { note: string, structuredIntro: StructuredIntro }]
}>()

const open = defineModel<boolean>({ default: false })

const form = reactive<{
  roleContext: string
  whyFit: string
  whyNow: string
  proposedNextStep: ConnectRequestNextStep
}>({
  roleContext: props.defaultRoleContext,
  whyFit: "",
  whyNow: "",
  proposedNextStep: "intro_call",
})

function resetForm() {
  form.roleContext = props.defaultRoleContext
  form.whyFit = ""
  form.whyNow = ""
  form.proposedNextStep = "intro_call"
}

watch(() => open.value, (isOpen) => {
  if (isOpen)
    resetForm()
})

const canSubmit = computed(() => {
  return form.roleContext.trim().length >= 3
    && form.whyFit.trim().length >= 24
    && form.whyNow.trim().length >= 18
})

const structuredIntro = computed<StructuredIntro>(() => ({
  context: props.context,
  roleContext: form.roleContext.trim(),
  whyFit: form.whyFit.trim(),
  whyNow: form.whyNow.trim(),
  proposedNextStep: form.proposedNextStep,
}))

const previewNote = computed(() => buildStructuredIntroNote(structuredIntro.value))

function submit() {
  if (!canSubmit.value)
    return

  emit("submit", {
    note: previewNote.value,
    structuredIntro: structuredIntro.value,
  })
}
</script>

<template>
  <BaseDialog v-model="open" :title="title" :description="description">
    <div class="gap-4 grid">
      <TextInput
        v-model="form.roleContext"
        label="Role or scope"
        :helper="`What role, wedge, or startup need are you responding to for ${targetLabel}?`"
      />
      <TextareaInput
        v-model="form.whyFit"
        label="Why you"
        helper="Point to capability, domain context, or shipped work that makes the fit credible."
        :rows="4"
      />
      <TextareaInput
        v-model="form.whyNow"
        label="Why now"
        helper="Explain timing, urgency, or why this is worth a live conversation this week."
        :rows="4"
      />
      <SelectInput
        v-model="form.proposedNextStep"
        label="Proposed next step"
        :options="connectRequestNextStepOptions"
      />
    </div>

    <div class="panel-inset mt-4 p-4">
      <p class="text-sm font-semibold">
        Intro preview
      </p>
      <p class="muted text-sm leading-6 mt-2">
        {{ previewNote }}
      </p>
    </div>

    <p v-if="unlockCopy" class="muted text-sm leading-6 mt-4">
      {{ unlockCopy }}
    </p>
    <p v-if="quotaCopy" class="muted text-sm leading-6 mt-2">
      {{ quotaCopy }}
    </p>

    <div class="mt-5 flex justify-end">
      <BaseButton :disabled="!canSubmit" @click="submit">
        Send structured intro
      </BaseButton>
    </div>
  </BaseDialog>
</template>
