import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { buildRelationshipAnalytics } from "../../shared/utils/relationship-analytics"

describe("relationship analytics", () => {
  it("builds the workflow funnel from relationship entities", () => {
    const analytics = buildRelationshipAnalytics(workspaceSeed)

    expect(analytics.funnel.map(stage => [stage.id, stage.count])).toEqual([
      ["intros", 4],
      ["matches", 2],
      ["trials", 1],
      ["proposals", 2],
      ["contracts", 1],
      ["signed", 0],
    ])
    expect(analytics.introAcceptanceRate).toBe(67)
    expect(analytics.trialActivationRate).toBe(50)
    expect(analytics.proposalCoverageRate).toBe(100)
    expect(analytics.contractGenerationRate).toBe(50)
    expect(analytics.signatureCompletionRate).toBe(50)
  })

  it("calculates average lifecycle durations only from completed samples", () => {
    const analytics = buildRelationshipAnalytics(workspaceSeed)
    const metrics = new Map(analytics.timeMetrics.map(metric => [metric.id, metric]))

    expect(metrics.get("first-reply")?.sampleSize).toBe(2)
    expect(metrics.get("first-reply")?.averageHours).toBeCloseTo(28.4, 1)
    expect(metrics.get("first-reply")?.valueLabel).toBe("28.4h")

    expect(metrics.get("match-to-proposal")?.sampleSize).toBe(2)
    expect(metrics.get("match-to-proposal")?.valueLabel).toBe("1.6 days")

    expect(metrics.get("proposal-to-contract")?.sampleSize).toBe(1)
    expect(metrics.get("proposal-to-contract")?.valueLabel).toBe("26.3h")

    expect(metrics.get("proposal-to-signed")?.sampleSize).toBe(0)
    expect(metrics.get("proposal-to-signed")?.valueLabel).toBe("No completed samples")
  })

  it("surfaces actionable relationship bottlenecks", () => {
    const analytics = buildRelationshipAnalytics(workspaceSeed)

    expect(analytics.bottlenecks.map(item => [item.id, item.severity, item.count])).toEqual([
      ["pending-intros", "medium", 1],
      ["proposals-without-contracts", "medium", 1],
      ["contracts-awaiting-signatures", "high", 1],
    ])
  })

  it("treats contracts as fully signed once all required participants sign", () => {
    const analytics = buildRelationshipAnalytics({
      ...workspaceSeed,
      contracts: workspaceSeed.contracts.map(contract => ({
        ...contract,
        status: "signed",
        updatedAt: "2026-04-11T17:30:00.000Z",
      })),
      signatures: [
        ...workspaceSeed.signatures,
        {
          contractId: "contract_ledgerloop",
          contractVersionId: "contract_version_ledgerloop_1",
          id: "signature_malik",
          signedAt: "2026-04-11T17:30:00.000Z",
          typedName: "Malik Thompson",
          userId: "user_malik",
        },
      ],
    })
    const proposalToSigned = analytics.timeMetrics.find(metric => metric.id === "proposal-to-signed")

    expect(analytics.funnel.find(stage => stage.id === "signed")?.count).toBe(1)
    expect(analytics.signatureCompletionRate).toBe(100)
    expect(proposalToSigned?.sampleSize).toBe(1)
    expect(proposalToSigned?.valueLabel).toBe("2.3 days")
    expect(analytics.bottlenecks.some(item => item.id === "contracts-awaiting-signatures")).toBe(false)
  })
})
