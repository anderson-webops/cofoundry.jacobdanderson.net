import { describe, expect, it } from "vitest"
import { evaluatePublicIntakeQuality } from "../../shared/utils/intake-quality"

describe("public intake quality", () => {
  it("accepts specific access requests from durable email domains", () => {
    const result = evaluatePublicIntakeQuality({
      email: "olivia@ledgerloop.co",
      kind: "access_request",
      message: "I want to evaluate a technical cofounder relationship, structure a two week trial, and document proposal terms before signing an agreement.",
      name: "Olivia Chen",
      subject: "Workspace access request",
    })

    expect(result.accepted).toBe(true)
    expect(result.issues).toEqual([])
  })

  it("rejects reserved or disposable email domains", () => {
    const reserved = evaluatePublicIntakeQuality({
      email: "founder@example.com",
      kind: "access_request",
      message: "I want a founder workspace for a cofounder search with structured proposals and agreement workflow.",
      name: "Founder Example",
      subject: "Workspace access request",
    })
    const disposable = evaluatePublicIntakeQuality({
      email: "founder@mailinator.com",
      kind: "contact",
      message: "I need help understanding CoFoundry workspace access and agreement workflows.",
      name: "Founder Example",
      subject: "Access help",
    })

    expect(reserved.issues.map(issue => issue.code)).toContain("reserved_email_domain")
    expect(disposable.issues.map(issue => issue.code)).toContain("disposable_email")
  })

  it("rejects url stuffing and obvious unrelated solicitations", () => {
    const result = evaluatePublicIntakeQuality({
      email: "vendor@rankgrowth.co",
      kind: "contact",
      message: "We offer guest posts and backlinks at https://a.example https://b.example https://c.example for rank on google.",
      name: "Rank Growth",
      subject: "Marketing services",
    })

    expect(result.accepted).toBe(false)
    expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(["spam_phrase", "url_stuffing"]))
  })

  it("rejects filler text without blocking legitimate crypto-related startup requests", () => {
    const filler = evaluatePublicIntakeQuality({
      email: "founder@signaldeck.co",
      kind: "contact",
      message: "asdf testing testing aaaaaaaaaaaaa",
      name: "Aaaa",
      subject: "Help",
    })
    const cryptoStartup = evaluatePublicIntakeQuality({
      email: "maya@custodyops.co",
      kind: "access_request",
      message: "I am building crypto custody compliance tooling and need a structured cofounder trial, proposal workflow, and agreement workspace.",
      name: "Maya Patel",
      subject: "Workspace access request",
    })

    expect(filler.accepted).toBe(false)
    expect(filler.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(["repeated_filler", "test_content"]))
    expect(cryptoStartup.accepted).toBe(true)
  })
})
