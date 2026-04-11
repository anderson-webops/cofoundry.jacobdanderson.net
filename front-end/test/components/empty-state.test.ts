import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import EmptyState from "../../src/components/ui/EmptyState.vue"

describe("emptyState", () => {
  it("renders title and description", () => {
    const wrapper = mount(EmptyState, {
      props: {
        title: "Nothing here",
        description: "Try broadening your search.",
      },
    })

    expect(wrapper.text()).toContain("Nothing here")
    expect(wrapper.text()).toContain("Try broadening your search.")
  })
})
