<script setup lang="ts">
import { computed, resolveComponent } from "vue"

const props = withDefaults(defineProps<{
  to?: string
  href?: string
  rel?: string
  target?: "_blank" | "_parent" | "_self" | "_top"
  type?: "button" | "submit" | "reset"
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
  block?: boolean
  disabled?: boolean
}>(), {
  type: "button",
  variant: "primary",
  size: "md",
  block: false,
  disabled: false,
})

const componentTag = computed(() => {
  if (props.to)
    return resolveComponent("NuxtLink")

  if (props.href)
    return "a"

  return "button"
})

const externalHttpLink = computed(() => Boolean(props.href && /^https?:\/\//i.test(props.href)))
const linkRel = computed(() => props.rel || (externalHttpLink.value ? "noopener noreferrer" : undefined))
const linkTarget = computed(() => props.target || (externalHttpLink.value ? "_blank" : undefined))

const variantClasses = computed(() => ({
  primary: "bg-[var(--accent)] text-[var(--cta-accent-text)] hover:bg-[var(--accent-strong)] border-transparent",
  secondary: "bg-[var(--panel-strong)] text-[var(--text)] border-[var(--line)] hover:border-[var(--line-strong)]",
  ghost: "bg-transparent text-[var(--text)] border-transparent hover:bg-[var(--accent-soft)]",
  danger: "bg-[var(--danger)] text-white border-transparent hover:opacity-90",
}[props.variant]))

const sizeClasses = computed(() => ({
  sm: "text-sm px-3 py-2 rounded-xl",
  md: "text-sm px-4 py-2.75 rounded-2xl",
  lg: "text-base px-5 py-3 rounded-2xl",
}[props.size]))
</script>

<template>
  <component
    :is="componentTag"
    :to="to"
    :href="href"
    :rel="linkRel"
    :target="linkTarget"
    :type="componentTag === 'button' ? type : undefined"
    :disabled="disabled"
    class="font-semibold border inline-flex gap-2 transition duration-150 ease-out items-center justify-center"
    :class="[variantClasses, sizeClasses, block ? 'w-full' : '']"
  >
    <slot />
  </component>
</template>
