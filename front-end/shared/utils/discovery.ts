import type { Profile, SearchFilters, Skill, StartupOpportunity, WorkspaceSeed } from "../types/domain"
import { buildProfileTrustScore, isRecentlyActive } from "./formation"

const normalize = (value: string) => value.trim().toLowerCase()

function includesNormalized(haystack: string, needle: string) {
  return normalize(haystack).includes(normalize(needle))
}

function countOverlap(left: string[], right: string[]) {
  return left.filter(item => right.includes(item)).length
}

function isSameLocation(left: string, right: string) {
  return normalize(left) !== "" && normalize(left) === normalize(right)
}

function buildReciprocityScore(profile: Profile) {
  let score = 0

  if (profile.trustSignals.replyRatePercent >= 90)
    score += 4
  else if (profile.trustSignals.replyRatePercent >= 75)
    score += 3
  else if (profile.trustSignals.replyRatePercent >= 60)
    score += 2
  else if (profile.trustSignals.replyRatePercent >= 40)
    score += 1

  if (profile.trustSignals.medianReplyHours <= 12)
    score += 3
  else if (profile.trustSignals.medianReplyHours <= 24)
    score += 2
  else if (profile.trustSignals.medianReplyHours <= 48)
    score += 1

  if (isRecentlyActive(profile.trustSignals.lastActiveAt))
    score += 2

  return score
}

function buildProfileMutualFitScore(viewer: Profile, candidate: Profile) {
  let score = 0

  if (viewer.hasIdea && candidate.wantsToJoinIdea)
    score += 4

  if (viewer.wantsToJoinIdea && candidate.hasIdea)
    score += 4

  score += countOverlap(candidate.industries, viewer.industries) * 2
  score += countOverlap(candidate.startupStagePreferences, viewer.startupStagePreferences) * 2
  score += countOverlap(candidate.compensationPreferences, viewer.compensationPreferences)
  score += countOverlap(candidate.intent.companyPreferences, viewer.intent.companyPreferences) * 2
  score += countOverlap(candidate.values, viewer.values)
  score += countOverlap(candidate.workStylePreferences, viewer.workStylePreferences)

  if (candidate.timeCommitment === viewer.timeCommitment)
    score += 2

  if (candidate.governancePreferences.equityPhilosophy === viewer.governancePreferences.equityPhilosophy)
    score += 2

  if (candidate.governancePreferences.decisionModelPreference === viewer.governancePreferences.decisionModelPreference)
    score += 1

  if (candidate.commitmentProfile.runwayBucket === viewer.commitmentProfile.runwayBucket)
    score += 1

  if (isSameLocation(candidate.location, viewer.location))
    score += 3
  else if (candidate.remotePreference === viewer.remotePreference)
    score += 1

  if (candidate.roles.some(role => !viewer.roles.includes(role)))
    score += 1

  return score
}

function buildSegmentDensityScore(seed: WorkspaceSeed, viewer: Profile, candidate: Profile) {
  return seed.profiles
    .filter(profile => profile.userId !== candidate.userId && profile.userId !== viewer.userId)
    .reduce((score, profile) => {
      const sameRolePair = profile.roles.some(role => candidate.roles.includes(role) && !viewer.roles.includes(role))
      const sameIndustry = profile.industries.some(industry => candidate.industries.includes(industry) && viewer.industries.includes(industry))
      const sameStage = profile.startupStagePreferences.some(stage => candidate.startupStagePreferences.includes(stage) && viewer.startupStagePreferences.includes(stage))

      if (sameRolePair || sameIndustry || sameStage)
        return score + 1

      return score
    }, 0)
}

function buildProfileRecommendationScore(seed: WorkspaceSeed, candidate: Profile, viewer?: Profile) {
  const trustScore = buildProfileTrustScore(candidate)
  const reciprocityScore = buildReciprocityScore(candidate)
  const mutualFitScore = viewer ? buildProfileMutualFitScore(viewer, candidate) : 0
  const densityScore = viewer ? Math.min(buildSegmentDensityScore(seed, viewer, candidate), 4) : 0

  return {
    trustScore,
    reciprocityScore,
    mutualFitScore,
    densityScore,
    total: trustScore + reciprocityScore + mutualFitScore + densityScore,
  }
}

function buildOpportunityFitScore(profile: Profile, opportunity: StartupOpportunity) {
  let score = 0

  if (opportunity.rolesNeeded.some(role => profile.roles.includes(role)))
    score += 4

  score += countOverlap(profile.industries, opportunity.industries) * 2

  if (opportunity.remotePreference === profile.remotePreference)
    score += 2

  if (isSameLocation(opportunity.location, profile.location))
    score += 3

  if (profile.startupStagePreferences.includes(opportunity.stage))
    score += 2

  if (profile.timeCommitment === opportunity.expectedCommitment)
    score += 2

  if (profile.compensationPreferences.includes(opportunity.compensationStructure))
    score += 1

  if (opportunity.verificationStatus === "domain_verified")
    score += 2
  else if (opportunity.verificationStatus === "owner_verified")
    score += 1

  return score
}

export function createEmptySearchFilters(): SearchFilters {
  return {
    query: "",
    roles: [],
    skills: [],
    industries: [],
    location: "",
    remotePreference: "any",
    stage: "any",
    timeCommitment: "any",
    compensationType: "any",
    minimumWeeklyHours: "",
    runwayBucket: "any",
    equityPhilosophy: "any",
    equityExpectationRange: "",
  }
}

export function filterProfiles(seed: WorkspaceSeed, filters: SearchFilters, viewer?: Profile) {
  const profileSkillMap = new Map<string, string[]>()

  seed.profileSkills.forEach((profileSkill) => {
    const skillLabel = seed.skills.find(skill => skill.id === profileSkill.skillId)?.label
    if (!skillLabel)
      return

    const existing = profileSkillMap.get(profileSkill.profileId) || []
    existing.push(skillLabel)
    profileSkillMap.set(profileSkill.profileId, existing)
  })

  return seed.profiles
    .map((profile) => {
      const searchableValues = [
        profile.displayName,
        profile.headline,
        profile.bio,
        ...profile.roles,
        ...profile.industries,
        ...profile.intent.companyPreferences,
        ...profile.intent.nonNegotiables,
      ]
      const queryMatchCount = filters.query
        ? searchableValues.filter(value => includesNormalized(value, filters.query)).length
        : 0

      return {
        profile,
        queryMatchCount,
        ranking: buildProfileRecommendationScore(seed, profile, viewer),
      }
    })
    .filter(({ profile }) => {
      const queryMatches = !filters.query
        || [
          profile.displayName,
          profile.headline,
          profile.bio,
          ...profile.roles,
          ...profile.industries,
          ...profile.intent.companyPreferences,
        ].some(value => includesNormalized(value, filters.query))

      const rolesMatch = !filters.roles.length || filters.roles.some(role => profile.roles.includes(role))
      const skillsMatch = !filters.skills.length || filters.skills.every(skill => (profileSkillMap.get(profile.id) || []).includes(skill))
      const industriesMatch = !filters.industries.length || filters.industries.some(industry => profile.industries.includes(industry))
      const locationMatch = !filters.location || includesNormalized(profile.location, filters.location)
      const remoteMatch = filters.remotePreference === "any" || profile.remotePreference === filters.remotePreference
      const stageMatch = filters.stage === "any" || profile.startupStagePreferences.includes(filters.stage)
      const commitmentMatch = filters.timeCommitment === "any" || profile.timeCommitment === filters.timeCommitment
      const compensationMatch = filters.compensationType === "any" || profile.compensationPreferences.includes(filters.compensationType)
      const weeklyHoursMatch = !filters.minimumWeeklyHours || profile.commitmentProfile.weeklyAvailabilityHours >= Number(filters.minimumWeeklyHours)
      const runwayMatch = filters.runwayBucket === "any" || profile.commitmentProfile.runwayBucket === filters.runwayBucket
      const equityPhilosophyMatch = filters.equityPhilosophy === "any" || profile.governancePreferences.equityPhilosophy === filters.equityPhilosophy
      const equityMatch = !filters.equityExpectationRange || includesNormalized(profile.equityExpectationRange, filters.equityExpectationRange)

      return queryMatches
        && rolesMatch
        && skillsMatch
        && industriesMatch
        && locationMatch
        && remoteMatch
        && stageMatch
        && commitmentMatch
        && compensationMatch
        && weeklyHoursMatch
        && runwayMatch
        && equityPhilosophyMatch
        && equityMatch
    })
    .sort((left, right) => {
      if (right.queryMatchCount !== left.queryMatchCount)
        return right.queryMatchCount - left.queryMatchCount

      if (right.ranking.total !== left.ranking.total)
        return right.ranking.total - left.ranking.total

      return right.ranking.trustScore - left.ranking.trustScore
    })
    .map(entry => entry.profile)
}

export function filterOpportunities(seed: WorkspaceSeed, filters: SearchFilters, viewer?: Profile) {
  return seed.opportunities
    .map((opportunity) => {
      const queryMatchCount = filters.query
        ? [opportunity.startupName, opportunity.oneLinePitch, opportunity.problem, ...opportunity.rolesNeeded, ...opportunity.industries]
            .filter(value => includesNormalized(value, filters.query))
            .length
        : 0

      return {
        opportunity,
        queryMatchCount,
        fitScore: viewer ? buildOpportunityFitScore(viewer, opportunity) : 0,
      }
    })
    .filter(({ opportunity }) => {
      const queryMatches = !filters.query
        || [opportunity.startupName, opportunity.oneLinePitch, opportunity.problem, ...opportunity.rolesNeeded, ...opportunity.industries]
          .some(value => includesNormalized(value, filters.query))
      const rolesMatch = !filters.roles.length || filters.roles.some(role => opportunity.rolesNeeded.includes(role))
      const industriesMatch = !filters.industries.length || filters.industries.some(industry => opportunity.industries.includes(industry))
      const locationMatch = !filters.location || includesNormalized(opportunity.location, filters.location)
      const remoteMatch = filters.remotePreference === "any" || opportunity.remotePreference === filters.remotePreference
      const stageMatch = filters.stage === "any" || opportunity.stage === filters.stage
      const commitmentMatch = filters.timeCommitment === "any" || opportunity.expectedCommitment === filters.timeCommitment
      const compensationMatch = filters.compensationType === "any" || opportunity.compensationStructure === filters.compensationType
      const equityMatch = !filters.equityExpectationRange || includesNormalized(opportunity.equityRange, filters.equityExpectationRange)

      return queryMatches
        && rolesMatch
        && industriesMatch
        && locationMatch
        && remoteMatch
        && stageMatch
        && commitmentMatch
        && compensationMatch
        && equityMatch
    })
    .sort((left, right) => {
      if (right.queryMatchCount !== left.queryMatchCount)
        return right.queryMatchCount - left.queryMatchCount

      return right.fitScore - left.fitScore
    })
    .map(entry => entry.opportunity)
}

export function recommendProfilesForOpportunity(seed: WorkspaceSeed, opportunity: StartupOpportunity) {
  const profileSkills = new Map<string, Skill[]>()

  seed.profileSkills.forEach((profileSkill) => {
    const skill = seed.skills.find(item => item.id === profileSkill.skillId)
    if (!skill)
      return

    const skills = profileSkills.get(profileSkill.profileId) || []
    skills.push(skill)
    profileSkills.set(profileSkill.profileId, skills)
  })

  return seed.profiles
    .map((profile) => {
      const skills = profileSkills.get(profile.id) || []
      let score = 0

      if (profile.roles.some(role => opportunity.rolesNeeded.includes(role)))
        score += 3

      if (profile.industries.some(industry => opportunity.industries.includes(industry)))
        score += 2

      if (profile.remotePreference === opportunity.remotePreference)
        score += 1

      if (profile.startupStagePreferences.includes(opportunity.stage))
        score += 2

      if (profile.timeCommitment === opportunity.expectedCommitment)
        score += 2

      if (isSameLocation(profile.location, opportunity.location))
        score += 3
      else if (profile.remotePreference === opportunity.remotePreference)
        score += 1

      opportunity.rolesNeeded.forEach((role) => {
        if (skills.some(skill => includesNormalized(skill.label, role)))
          score += 1
      })

      const ranking = buildProfileRecommendationScore(seed, profile)
      score += ranking.trustScore + ranking.reciprocityScore

      return { profile, score, reciprocityScore: ranking.reciprocityScore }
    })
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score)
}

export function recommendProfilesForProfile(seed: WorkspaceSeed, profile: Profile) {
  return seed.profiles
    .filter(candidate => candidate.userId !== profile.userId)
    .map((candidate) => {
      const ranking = buildProfileRecommendationScore(seed, candidate, profile)

      return {
        profile: candidate,
        score: ranking.total,
        reciprocityScore: ranking.reciprocityScore,
        localBias: isSameLocation(candidate.location, profile.location),
      }
    })
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score)
}

export function recommendOpportunitiesForProfile(seed: WorkspaceSeed, profile: Profile) {
  return seed.opportunities
    .map((opportunity) => {
      return { opportunity, score: buildOpportunityFitScore(profile, opportunity) }
    })
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score)
}
