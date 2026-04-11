import type { Profile, SearchFilters, Skill, StartupOpportunity, WorkspaceSeed } from "../types/domain"
import { buildProfileTrustScore } from "./formation"

const normalize = (value: string) => value.trim().toLowerCase()

function includesNormalized(haystack: string, needle: string) {
  return normalize(haystack).includes(normalize(needle))
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

export function filterProfiles(seed: WorkspaceSeed, filters: SearchFilters) {
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
        trustScore: buildProfileTrustScore(profile),
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

      return right.trustScore - left.trustScore
    })
    .map(entry => entry.profile)
}

export function filterOpportunities(seed: WorkspaceSeed, filters: SearchFilters) {
  return seed.opportunities.filter((opportunity) => {
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
        score += 1

      opportunity.rolesNeeded.forEach((role) => {
        if (skills.some(skill => includesNormalized(skill.label, role)))
          score += 1
      })

      score += buildProfileTrustScore(profile)

      return { profile, score }
    })
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score)
}

export function recommendProfilesForProfile(seed: WorkspaceSeed, profile: Profile) {
  return seed.profiles
    .filter(candidate => candidate.userId !== profile.userId)
    .map((candidate) => {
      let score = 0

      if (profile.hasIdea && candidate.wantsToJoinIdea)
        score += 4

      if (profile.wantsToJoinIdea && candidate.hasIdea)
        score += 4

      if (candidate.industries.some(industry => profile.industries.includes(industry)))
        score += 2

      if (candidate.remotePreference === profile.remotePreference)
        score += 1

      if (candidate.timeCommitment === profile.timeCommitment)
        score += 1

      if (candidate.startupStagePreferences.some(stage => profile.startupStagePreferences.includes(stage)))
        score += 2

      if (candidate.compensationPreferences.some(preference => profile.compensationPreferences.includes(preference)))
        score += 1

      if (candidate.intent.companyPreferences.some(preference => profile.intent.companyPreferences.includes(preference)))
        score += 2

      if (candidate.roles.some(role => !profile.roles.includes(role)))
        score += 1

      if (candidate.governancePreferences.equityPhilosophy === profile.governancePreferences.equityPhilosophy)
        score += 2

      if (candidate.governancePreferences.decisionModelPreference === profile.governancePreferences.decisionModelPreference)
        score += 1

      if (candidate.commitmentProfile.runwayBucket === profile.commitmentProfile.runwayBucket)
        score += 1

      score += buildProfileTrustScore(candidate)

      return { profile: candidate, score }
    })
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score)
}

export function recommendOpportunitiesForProfile(seed: WorkspaceSeed, profile: Profile) {
  return seed.opportunities
    .map((opportunity) => {
      let score = 0

      if (opportunity.rolesNeeded.some(role => profile.roles.includes(role)))
        score += 3

      if (profile.industries.some(industry => opportunity.industries.includes(industry)))
        score += 2

      if (opportunity.remotePreference === profile.remotePreference)
        score += 1

      if (profile.startupStagePreferences.includes(opportunity.stage))
        score += 2

      if (profile.timeCommitment === opportunity.expectedCommitment)
        score += 1

      if (profile.compensationPreferences.includes(opportunity.compensationStructure))
        score += 1

      return { opportunity, score }
    })
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score)
}
