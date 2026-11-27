import { defineComponent, h } from "vue"

export const NuxtLink = defineComponent({
  name: "NuxtLink",
  props: {
    to: { type: String, required: true },
  },
  setup(properties, { slots }) {
    return () => h("a", { href: properties.to }, slots.default?.())
  },
})
