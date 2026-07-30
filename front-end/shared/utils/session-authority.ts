import type { SessionUser, WorkspaceSeed } from "../types/domain"
import { getUserById } from "./workspace"
import { resolveSessionUserFromWorkspace } from "./workspace-persistence"

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
