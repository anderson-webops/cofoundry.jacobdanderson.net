import type { AppRole } from "../types/domain"

export interface AdminSecurityUser {
  id: string
  role: AppRole
  suspendedAt: string | null
  verifiedEmail: boolean
}

export type AdminSecurityMutation
  = | { kind: "change_role", role: AppRole }
    | { action: "reinstate" | "suspend", kind: "change_status" }
    | { kind: "verify_email" }

export interface AdminSecurityDecision {
  allowed: boolean
  statusCode: number
  statusMessage: string
}

function deny(statusMessage: string, statusCode = 403): AdminSecurityDecision {
  return { allowed: false, statusCode, statusMessage }
}

export function evaluateAdminSecurityMutation(
  users: AdminSecurityUser[],
  actorUserId: string,
  targetUserId: string,
  mutation: AdminSecurityMutation,
): AdminSecurityDecision {
  const actor = users.find(user => user.id === actorUserId)
  const target = users.find(user => user.id === targetUserId)

  if (!actor || actor.suspendedAt || !actor.verifiedEmail || actor.role !== "admin")
    return deny("An active full admin account is required for this action.")

  if (!target)
    return deny("Target user was not found.", 404)

  if (actor.id === target.id)
    return deny("Administrators cannot change their own role, status, or verification state.", 400)

  const activeFullAdminCount = users.filter(user =>
    user.role === "admin" && !user.suspendedAt && user.verifiedEmail,
  ).length

  if (mutation.kind === "change_role") {
    if (mutation.role === target.role)
      return deny("Choose a different role before recording a role change.", 409)
    if (target.suspendedAt && ["admin", "investor_admin"].includes(mutation.role))
      return deny("Reinstate the account before granting a privileged role.", 409)
    if (!target.verifiedEmail && ["admin", "investor_admin"].includes(mutation.role))
      return deny("Verify the account email before granting a privileged role.", 409)
    if (target.role === "admin" && mutation.role !== "admin" && !target.suspendedAt && target.verifiedEmail && activeFullAdminCount <= 1)
      return deny("The last active full admin cannot be demoted.", 409)

    return { allowed: true, statusCode: 200, statusMessage: "Role change allowed." }
  }

  if (mutation.kind === "verify_email") {
    if (target.verifiedEmail)
      return deny("This email address is already verified.", 409)

    return { allowed: true, statusCode: 200, statusMessage: "Email verification allowed." }
  }

  if (mutation.action === "suspend") {
    if (target.suspendedAt)
      return deny("This account is already suspended.", 409)
    if (target.role === "admin" && target.verifiedEmail && activeFullAdminCount <= 1)
      return deny("The last active full admin cannot be suspended.", 409)
  }
  else if (!target.suspendedAt) {
    return deny("This account is not suspended.", 409)
  }
  else if (!target.verifiedEmail && ["admin", "investor_admin"].includes(target.role)) {
    return deny("Verify the account email before reinstating a privileged role.", 409)
  }

  return { allowed: true, statusCode: 200, statusMessage: "Status change allowed." }
}
