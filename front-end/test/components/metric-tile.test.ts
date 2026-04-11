import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import MetricTile from "../../src/components/ui/MetricTile.vue"

describe("metricTile", () => {
  it("renders label, value, and context", () => {
    const wrapper = mount(MetricTile, {
      props: {
        label: "Matches",
        value: "12",
        context: "Mutual introductions",
      },
    })

    expect(wrapper.text()).toContain("Matches")
    expect(wrapper.text()).toContain("12")
    expect(wrapper.text()).toContain("Mutual introductions")
  })
})
