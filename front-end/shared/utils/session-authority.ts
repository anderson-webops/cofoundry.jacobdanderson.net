import type { SessionUser, WorkspaceSeed } from "../types/domain"
import { getUserById } from "./workspace"
import { resolveSessionUserFromWorkspace } from "./workspace-persistence"

export function canAccessCoreMemberWorkspace(input: Pick<SessionUser, "role">) {
  return input.role !== "investor_admin"
}

export function resolveActiveSessionFromSeed(seed: WorkspaceSeed, input: SessionUser) {
  const session = resolveSessionUserFromWorkspace(seed, input)
  const user = getUserById(seed, session.id)

  if (
    !user
    || user.suspendedAt
    || (["admin", "investor_admin"].includes(user.role) && !user.verifiedEmail)
  ) {
    return null
  }

  return session
}

export function resolveSeededStaffSessionFromSeed(seed: WorkspaceSeed, input: SessionUser) {
  const user = getUserById(seed, input.id)

  if (
    !user
    || !["admin", "investor_admin"].includes(user.role)
    || user.email.trim().toLowerCase() !== input.email.trim().toLowerCase()
  ) {
    return null
  }

  return resolveActiveSessionFromSeed(seed, input)
}
