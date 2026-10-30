import { describe, expect, it } from "vitest"
import { evaluateAdminSecurityMutation } from "../../shared/utils/admin-authorization"

const users = [
  {
    id: "admin_primary",
    role: "admin" as const,
    suspendedAt: null,
    verifiedEmail: true
  },
  {
    id: "investor_admin",
    role: "investor_admin" as const,
    suspendedAt: null,
    verifiedEmail: true
  },
  {
    id: "member",
    role: "founder" as const,
    suspendedAt: null,
    verifiedEmail: false
  },
  {
    id: "suspended_member",
    role: "collaborator" as const,
    suspendedAt: "2026-07-01T12:00:00.000Z",
    verifiedEmail: false
  },
]

describe("admin security authorization", () => {
  it("reserves role and manual verification changes for a full admin", () => {
    expect(evaluateAdminSecurityMutation(users, "investor_admin", "member", {
      kind: "change_role",
      role: "admin",
    }).allowed).toBe(false)
    expect(evaluateAdminSecurityMutation(users, "investor_admin", "member", {
      kind: "verify_email",
    }).allowed).toBe(false)

    const unverifiedActorUsers = [
      ...users.filter(user => user.id !== "admin_primary"),
      {
        id: "admin_primary",
        role: "admin" as const,
        suspendedAt: null,
        verifiedEmail: false
      },
    ]
    expect(evaluateAdminSecurityMutation(unverifiedActorUsers, "admin_primary", "member", {
      kind: "verify_email",
    }).allowed).toBe(false)
  })

  it("prevents self-management and all investor-admin account moderation", () => {
    expect(evaluateAdminSecurityMutation(users, "admin_primary", "admin_primary", {
      action: "suspend",
      kind: "change_status",
    }).allowed).toBe(false)
    expect(evaluateAdminSecurityMutation(users, "investor_admin", "admin_primary", {
      action: "suspend",
      kind: "change_status",
    }).allowed).toBe(false)
    expect(evaluateAdminSecurityMutation(users, "investor_admin", "member", {
      action: "suspend",
      kind: "change_status",
    }).allowed).toBe(false)
  })

  it("prevents suspending or demoting the final active full admin", () => {
    expect(evaluateAdminSecurityMutation(users, "admin_primary", "admin_primary", {
      kind: "change_role",
      role: "founder",
    }).allowed).toBe(false)

    const secondAdminUsers = [
      ...users,
      {
        id: "admin_secondary",
        role: "admin" as const,
        suspendedAt: null,
        verifiedEmail: true
      },
    ]
    expect(evaluateAdminSecurityMutation(secondAdminUsers, "admin_secondary", "admin_primary", {
      kind: "change_role",
      role: "founder",
    }).allowed).toBe(true)

    const unusableSecondAdminUsers = [
      ...users,
      {
        id: "admin_unverified",
        role: "admin" as const,
        suspendedAt: null,
        verifiedEmail: false
      },
    ]
    expect(evaluateAdminSecurityMutation(unusableSecondAdminUsers, "admin_primary", "admin_unverified", {
      action: "suspend",
      kind: "change_status",
    }).allowed).toBe(true)
    expect(evaluateAdminSecurityMutation(unusableSecondAdminUsers, "admin_unverified", "admin_primary", {
      action: "suspend",
      kind: "change_status",
    }).allowed).toBe(false)
  })

  it("requires reinstatement before granting a privileged role", () => {
    expect(evaluateAdminSecurityMutation(users, "admin_primary", "suspended_member", {
      kind: "change_role",
      role: "investor_admin",
    }).allowed).toBe(false)
    expect(evaluateAdminSecurityMutation(users, "admin_primary", "suspended_member", {
      action: "reinstate",
      kind: "change_status",
    }).allowed).toBe(true)
  })

  it("requires verified email before promotion or privileged reinstatement", () => {
    expect(evaluateAdminSecurityMutation(users, "admin_primary", "member", {
      kind: "change_role",
      role: "admin",
    })).toMatchObject({
      allowed: false,
      statusCode: 409,
    })

    const unverifiedSuspendedAdmin = [
      ...users,
      {
        id: "admin_unverified",
        role: "admin" as const,
        suspendedAt: "2026-07-01T12:00:00.000Z",
        verifiedEmail: false
      },
    ]
    expect(evaluateAdminSecurityMutation(unverifiedSuspendedAdmin, "admin_primary", "admin_unverified", {
      action: "reinstate",
      kind: "change_status",
    })).toMatchObject({
      allowed: false,
      statusCode: 409,
    })
  })
})
