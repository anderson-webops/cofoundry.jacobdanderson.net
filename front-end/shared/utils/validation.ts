import { z } from "zod"

export const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

export const signUpSchema = z.object({
  name: z.string().min(2, "Enter your full name."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

export const contactSchema = z.object({
  name: z.string().min(2, "Enter your name."),
  email: z.string().email("Enter a valid email."),
  company: z.string().optional(),
  subject: z.string().min(3, "Add a short subject."),
  message: z.string().min(20, "Please include enough detail for us to help."),
})

export const onboardingSchema = z.object({
  displayName: z.string().min(2, "Name is required."),
  headline: z.string().min(10, "Write a clearer headline."),
  bio: z.string().min(60, "Tell people enough to understand your background."),
  location: z.string().min(2, "Location is required."),
  remotePreference: z.enum(["remote", "hybrid", "in_person"]),
  roles: z.array(z.string()).min(1, "Choose at least one role."),
  yearsExperience: z.number().min(0).max(40),
  industries: z.array(z.string()).min(1, "Choose at least one industry."),
  startupStagePreferences: z.array(z.enum(["idea", "prototype", "mvp", "revenue", "growth"])).min(1, "Choose at least one stage."),
  compensationPreferences: z.array(z.enum(["equity_only", "cash_and_equity", "cash_only", "advisory"])).min(1, "Choose at least one compensation preference."),
  equityExpectationRange: z.string().min(2, "Equity expectation is required."),
  timeCommitment: z.enum(["nights_weekends", "part_time", "full_time"]),
  linkedin: z.string().url("Add a valid LinkedIn URL.").or(z.literal("")),
  github: z.string().url("Add a valid GitHub URL.").or(z.literal("")),
  portfolio: z.string().url("Add a valid portfolio URL.").or(z.literal("")),
  website: z.string().url("Add a valid personal site URL.").or(z.literal("")),
  hasIdea: z.boolean(),
  wantsToJoinIdea: z.boolean(),
  values: z.array(z.string()).min(1, "Add at least one value."),
  workStylePreferences: z.array(z.string()).min(1, "Add at least one work-style preference."),
  profileVisibility: z.enum(["public", "members", "private"]),
})

export const opportunitySchema = z.object({
  startupName: z.string().min(2, "Startup name is required."),
  oneLinePitch: z.string().min(12, "Write a clearer one-line pitch."),
  problem: z.string().min(50, "Describe the problem in more detail."),
  targetUsers: z.string().min(20, "Describe the target users."),
  stage: z.enum(["idea", "prototype", "mvp", "revenue", "growth"]),
  traction: z.string().min(20, "Add concrete traction or evidence."),
  expectedCommitment: z.enum(["nights_weekends", "part_time", "full_time"]),
  compensationStructure: z.enum(["equity_only", "cash_and_equity", "cash_only", "advisory"]),
  equityRange: z.string().min(2, "Equity range is required."),
  location: z.string().min(2, "Location is required."),
  remotePreference: z.enum(["remote", "hybrid", "in_person"]),
  industries: z.array(z.string()).min(1, "Add at least one industry."),
  rolesNeeded: z.array(z.string()).min(1, "Add at least one role."),
})

export const proposalSchema = z.object({
  roleTitle: z.string().min(2, "Role title is required."),
  responsibilities: z.array(z.string()).min(2, "Add at least two concrete responsibilities."),
  weeklyTimeCommitment: z.number().min(1).max(80),
  startDate: z.string().min(1, "Start date is required."),
  cashCompensation: z.string().min(2, "Describe the cash terms."),
  equity: z.string().min(2, "Describe the equity terms."),
  vestingSchedule: z.string().min(2, "Describe the vesting schedule."),
  cliff: z.string().min(2, "Describe the cliff."),
  decisionRights: z.string().min(10, "Explain how decision rights work."),
  ipAssignmentRequired: z.boolean(),
  confidentiality: z.string().min(10, "Explain confidentiality expectations."),
  exitTerms: z.string().min(10, "Explain exit terms."),
  notes: z.string().min(10, "Include additional context."),
})

export const contractSignatureSchema = z.object({
  typedName: z.string().min(2, "Type your full name to sign."),
})

export const profileSearchSchema = z.object({
  query: z.string(),
  roles: z.array(z.string()),
  skills: z.array(z.string()),
  industries: z.array(z.string()),
})

export const billingCheckoutSchema = z.object({
  plan: z.enum(["pro", "team"]),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
})
