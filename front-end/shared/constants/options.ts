import type { CompensationPreference, StartupStage } from "../types/domain"

export const roleOptions = [
  "Founder",
  "CEO",
  "CTO",
  "Technical Co-Founder",
  "Founding Engineer",
  "Product",
  "Founding Designer",
  "Sales",
  "Growth",
  "Operations",
]

export const industryOptions = [
  "Fintech",
  "Healthtech",
  "Developer Tools",
  "AI",
  "Compliance",
  "B2B SaaS",
  "Logistics",
  "Operations",
  "Climate",
  "Consumer",
]

export const valueOptions = [
  "Candor",
  "High trust",
  "Bias to action",
  "Customer empathy",
  "Technical rigor",
  "Calm execution",
  "Default to transparency",
  "Long-term ownership",
]

export const workStyleOptions = [
  "Write before meetings",
  "Weekly written updates",
  "Async-first communication",
  "Tight feedback loops",
  "Customer calls every week",
  "Lean process",
  "Clear decision logs",
  "Fast prototyping",
]

export const stageOptions: { label: string, value: StartupStage }[] = [
  { label: "Idea", value: "idea" },
  { label: "Prototype", value: "prototype" },
  { label: "MVP", value: "mvp" },
  { label: "Revenue", value: "revenue" },
  { label: "Growth", value: "growth" },
]

export const remoteOptions = [
  { label: "Remote", value: "remote" },
  { label: "Hybrid", value: "hybrid" },
  { label: "In person", value: "in_person" },
]

export const commitmentOptions = [
  { label: "Nights & weekends", value: "nights_weekends" },
  { label: "Part-time", value: "part_time" },
  { label: "Full-time", value: "full_time" },
]

export const compensationOptions: CompensationPreference[] = [
  "equity_only",
  "cash_and_equity",
  "cash_only",
  "advisory",
]
