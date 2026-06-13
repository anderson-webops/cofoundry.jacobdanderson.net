import type { Profile, User, WorkspaceSeed } from "../types/domain"
import { recommendOpportunitiesForProfile, recommendProfilesForProfile } from "./discovery"
import { buildProfileReadiness } from "./formation"
import { buildInboxSnapshot } from "./inbox"
import {
  getIncomingConnectRequestsForUser,
  getMatchesForUser,
  getOutgoingConnectRequestsForUser,
  getProfileByUserId,
  getUserById,
} from "./workspace"

export type ActivationStepId = "minimum_profile" | "trust_ready" | "first_intro" | "inbox_follow_up"
export type ActivationStepStatus = "complete" | "current" | "locked"

export interface ActivationStep {
  id: ActivationStepId
  title: string
  status: ActivationStepStatus
  complete: boolean
  badgeLabel: string
  badgeTone: "accent" | "neutral" | "success" | "warning"
  description: string
  ctaLabel: string
  href: string
  missingItems: string[]
}

export interface ActivationPlan {
  completedCount: number
  currentStep: ActivationStep | null
  inboxActionCount: number
  matchCount: number
  percent: number
  profilePercent: number
  recommendationCount: number
  stageDescription: string
  stageLabel: string
  steps: ActivationStep[]
  totalCount: number
  trustPercent: number
  waitingOnReplyCount: number
}

const minimumProfileItemIds = new Set(["identity", "role_signal", "company_fit", "commitment"])

function buildMissingMinimumItems(profile: Profile) {
  return buildProfileReadiness(profile).checklist.filter(item => minimumProfileItemIds.has(item.id) && !item.complete).map(item => item.title)
}

function buildRecommendationCount(seed: WorkspaceSeed, profile: Profile) {
  if (profile.hasIdea && !profile.wantsToJoinIdea)
    return recommendProfilesForProfile(seed, profile).length

  return recommendOpportunitiesForProfile(seed, profile).length
}

function stepStatus(complete: boolean, unlocked: boolean): ActivationStepStatus {
  if (complete)
    return "complete"

  return unlocked ? "current" : "locked"
}

function createStep(input: Omit<ActivationStep, "badgeLabel" | "badgeTone" | "status"> & { unlocked: boolean }): ActivationStep {
  const status = stepStatus(input.complete, input.unlocked)

  return {
    ...input,
    status,
    badgeLabel: status === "complete" ? "Done" : status === "current" ? "Next" : "Locked",
    badgeTone: status === "complete" ? "success" : status === "current" ? "warning" : "neutral",
  }
}

function hasStartedIntroPath(seed: WorkspaceSeed, userId: string) {
  return Boolean(
    getIncomingConnectRequestsForUser(seed, userId).length
    || getOutgoingConnectRequestsForUser(seed, userId).length
    || getMatchesForUser(seed, userId).length,
  )
}

function buildStageLabel(currentStep: ActivationStep | null) {
  if (!currentStep)
    return "Activation complete"

  return {
    minimum_profile: "Finish the minimum profile",
    trust_ready: "Strengthen trust signals",
    first_intro: "Act on one recommended intro",
    inbox_follow_up: "Clear follow-through",
  }[currentStep.id]
}

function buildStageDescription(currentStep: ActivationStep | null, plan: Pick<ActivationPlan, "inboxActionCount" | "recommendationCount" | "waitingOnReplyCount">) {
  if (!currentStep) {
    if (plan.waitingOnReplyCount > 0)
      return `${plan.waitingOnReplyCount} intro${plan.waitingOnReplyCount === 1 ? "" : "s"} are waiting on the other side; keep the inbox clear while they respond.`

    return "The profile, trust signal, first-intro, and inbox-follow-through gates are clear."
  }

  if (currentStep.id === "first_intro" && plan.recommendationCount > 0)
    return `${plan.recommendationCount} ranked recommendation${plan.recommendationCount === 1 ? "" : "s"} are available. Pick one strong fit before widening the search.`

  if (currentStep.id === "inbox_follow_up" && plan.inboxActionCount > 0)
    return `${plan.inboxActionCount} inbox action${plan.inboxActionCount === 1 ? "" : "s"} still need a response.`

  return currentStep.description
}

export function buildActivationPlan(seed: WorkspaceSeed, userId: string): ActivationPlan | null {
  const user = getUserById(seed, userId)
  const profile = getProfileByUserId(seed, userId)

  if (!user || !profile)
    return null

  return buildActivationPlanForMember(seed, user, profile)
}

export function buildActivationPlanForMember(seed: WorkspaceSeed, user: User, profile: Profile): ActivationPlan {
  const readiness = buildProfileReadiness(profile)
  const inbox = buildInboxSnapshot(seed, user.id)
  const minimumMissingItems = buildMissingMinimumItems(profile)
  const minimumComplete = user.onboardingCompleted && minimumMissingItems.length === 0
  const trustMissingItems = [...new Set([...readiness.missingTrustItems, ...readiness.missingOutreachItems])]
  const trustComplete = readiness.trustReady && readiness.readyForOutreach
  const recommendationCount = buildRecommendationCount(seed, profile)
  const firstIntroComplete = hasStartedIntroPath(seed, user.id)
  const inboxActionCount = inbox.actions.length
  const inboxFollowUpComplete = firstIntroComplete && inboxActionCount === 0

  const steps = [
    createStep({
      id: "minimum_profile",
      title: "Minimum profile",
      complete: minimumComplete,
      unlocked: true,
      description: minimumComplete
        ? "The basics are strong enough to rank relevant people and opportunities."
        : "Add the minimum identity, role, company-fit, and commitment details before discovery work starts.",
      ctaLabel: "Edit profile",
      href: "/app/profile/edit",
      missingItems: minimumMissingItems,
    }),
    createStep({
      id: "trust_ready",
      title: "Trust-critical profile",
      complete: trustComplete,
      unlocked: minimumComplete,
      description: trustComplete
        ? "Trust and outreach-critical details are complete."
        : "Complete proof, guardrails, governance, IP, and verification signals before sending new intros.",
      ctaLabel: "Strengthen profile",
      href: "/app/profile/edit",
      missingItems: trustMissingItems,
    }),
    createStep({
      id: "first_intro",
      title: "First recommended intro",
      complete: firstIntroComplete,
      unlocked: trustComplete,
      description: firstIntroComplete
        ? "At least one structured intro or match is already in motion."
        : "Use recommendations deliberately and act on one strong fit before opening more threads.",
      ctaLabel: recommendationCount > 0 ? "Open discover" : "Review profile",
      href: recommendationCount > 0 ? "/app/discover" : "/app/profile/edit",
      missingItems: recommendationCount > 0 ? [] : ["Ranked recommendation signal"],
    }),
    createStep({
      id: "inbox_follow_up",
      title: "Inbox-first follow-through",
      complete: inboxFollowUpComplete,
      unlocked: firstIntroComplete,
      description: inboxFollowUpComplete
        ? "No intro, message, proposal, contract, or notification currently needs action."
        : "Clear active intros, replies, proposal responses, signatures, and operational updates before adding more volume.",
      ctaLabel: "Open inbox",
      href: "/app/inbox",
      missingItems: inboxActionCount > 0 ? [`${inboxActionCount} open inbox action${inboxActionCount === 1 ? "" : "s"}`] : [],
    }),
  ]

  const completedCount = steps.filter(step => step.complete).length
  const currentStep = steps.find(step => step.status === "current") || null
  const planBasis = {
    inboxActionCount,
    recommendationCount,
    waitingOnReplyCount: inbox.counts.waitingOnReplies,
  }

  return {
    ...planBasis,
    completedCount,
    currentStep,
    matchCount: getMatchesForUser(seed, user.id).length,
    percent: Math.round((completedCount / steps.length) * 100),
    profilePercent: readiness.percent,
    stageDescription: buildStageDescription(currentStep, planBasis),
    stageLabel: buildStageLabel(currentStep),
    steps,
    totalCount: steps.length,
    trustPercent: readiness.trustPercent,
  }
}
