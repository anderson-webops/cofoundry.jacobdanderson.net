import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { buildSessionUser } from "../../shared/utils/workspace"
import { projectWorkspaceForSession } from "../../shared/utils/workspace-authorization"

describe("workspace response authorization", () => {
  it("limits a member response to their own or visible records", () => {
    const session = buildSessionUser(workspaceSeed, "user_emma")
    expect(session).toBeDefined()

    const projected = projectWorkspaceForSession(workspaceSeed, session!)

    expect(projected.adminActions).toEqual([])
    expect(projected.subscriptions.every(subscription => subscription.userId === session!.id)).toBe(true)
    expect(projected.notifications.every(notification => notification.userId === session!.id)).toBe(true)
    expect(projected.bookmarks.every(bookmark => bookmark.userId === session!.id)).toBe(true)
    expect(projected.savedSearches.every(search => search.userId === session!.id)).toBe(true)
    expect(projected.reports.every(report => report.reporterUserId === session!.id)).toBe(true)
    expect(projected.investmentApplications.every(application => application.applicantUserId === session!.id)).toBe(true)
    expect(projected.users.find(user => user.id === "user_olivia")?.email).toBe("")
    expect(projected.users.find(user => user.id === "user_olivia")?.linkedProviders).toEqual([])
    expect(projected.profiles.find(profile => profile.userId === "user_olivia")?.photoUrl).toBe("")
  })

  it("retains the admin operating view", () => {
    const session = buildSessionUser(workspaceSeed, "user_ava")
    expect(session?.role).toBe("admin")

    const projected = projectWorkspaceForSession(workspaceSeed, session!)

    expect(projected.users).toHaveLength(workspaceSeed.users.length)
    expect(projected.reports).toHaveLength(workspaceSeed.reports.length)
    expect(projected.adminActions).toHaveLength(workspaceSeed.adminActions.length)
  })

  it("keeps investor admins out of core member, moderation, and system data", () => {
    const session = buildSessionUser(workspaceSeed, "user_priya")
    expect(session?.role).toBe("investor_admin")

    const projected = projectWorkspaceForSession(workspaceSeed, session!)

    expect(projected.users.map(user => user.id)).toEqual(["user_priya"])
    expect(projected.profiles.map(profile => profile.userId)).toEqual(["user_priya"])
    expect(projected.opportunities).toEqual([])
    expect(projected.connectRequests).toEqual([])
    expect(projected.conversations).toEqual([])
    expect(projected.messages).toEqual([])
    expect(projected.reports.every(report => report.reporterUserId === session!.id)).toBe(true)
    expect(projected.adminActions).toEqual([])
    expect(projected.subscriptions.every(subscription => subscription.userId === session!.id)).toBe(true)
    expect(projected.investmentApplications.every(application => application.applicantUserId === session!.id)).toBe(true)
  })

  it("keeps internal moderation notes and admin identities out of member responses", () => {
    const session = buildSessionUser(workspaceSeed, "user_olivia")!
    const sourceReport = workspaceSeed.reports.find(report =>
      report.reporterUserId === session.id && report.reviewedByUserId,
    )
    expect(sourceReport).toBeDefined()

    const report = projectWorkspaceForSession(workspaceSeed, session)
      .reports
      .find(item => item.id === sourceReport!.id)

    expect(report).toMatchObject({
      id: sourceReport!.id,
      reporterUserId: session.id,
      resolutionNotes: null,
      resolvedByUserId: null,
      reviewNotes: null,
      reviewedByUserId: null,
      status: sourceReport!.status,
    })
  })

  it("keeps private storage coordinates and scanner notes out of member responses", () => {
    const session = buildSessionUser(workspaceSeed, "user_olivia")!
    const sourceUpload = workspaceSeed.fileUploads.find(upload => upload.ownerUserId === session.id)
    expect(sourceUpload).toBeDefined()

    const upload = projectWorkspaceForSession(workspaceSeed, session)
      .fileUploads
      .find(item => item.id === sourceUpload!.id)

    expect(upload).toMatchObject({
      bucket: "",
      id: sourceUpload!.id,
      objectPath: "",
      scanNotes: null,
      scanStatus: sourceUpload!.scanStatus,
      status: sourceUpload!.status,
    })
  })

  it("does not treat a pending intro as permission to view private portfolio or opportunity content", () => {
    const source = structuredClone(workspaceSeed)
    const session = buildSessionUser(source, "user_arjun")!
    const target = source.profiles.find(profile => profile.userId === "user_noah")!
    target.privacy.portfolioVisibility = "private"
    target.privacy.opportunityVisibility = "private"
    target.portfolio = [{
      id: "portfolio_private_pending_intro",
      name: "Confidential work",
      outcome: "Private diligence material",
      role: "Founder",
      summary: "Private diligence material",
      url: "https://private.example",
    }]
    const privateOpportunity = source.opportunities.find(opportunity => opportunity.ownerUserId === target.userId)!

    const projected = projectWorkspaceForSession(source, session)

    expect(projected.profiles.find(profile => profile.id === target.id)?.portfolio).toEqual([])
    expect(projected.opportunities.some(opportunity => opportunity.id === privateOpportunity.id)).toBe(false)
  })

  it("never exposes trust-evidence metadata to another member", () => {
    const session = buildSessionUser(workspaceSeed, "user_emma")!
    const projected = projectWorkspaceForSession(workspaceSeed, session)

    expect(projected.fileUploads.some(upload => upload.purpose === "trust_evidence")).toBe(false)
  })

  it("sanitizes persisted notification destinations for members and admins", () => {
    const source = structuredClone(workspaceSeed)
    const notification = source.notifications.find(item => item.userId === "user_olivia")!
    notification.href = "https://attacker.example/phish"

    const member = projectWorkspaceForSession(source, buildSessionUser(source, "user_olivia")!)
    const admin = projectWorkspaceForSession(source, buildSessionUser(source, "user_ava")!)

    expect(member.notifications.find(item => item.id === notification.id)?.href).toBe("/app/inbox")
    expect(admin.notifications.find(item => item.id === notification.id)?.href).toBe("/app/inbox")
  })
})
