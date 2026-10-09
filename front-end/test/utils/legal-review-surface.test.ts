import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8")
}

describe("external legal-review surface", () => {
  it("collects ordinary pageviews with one canonical tracker only", () => {
    const appSource = source("src/app.vue")
    expect(appSource.match(/"data-website-id":/g)).toHaveLength(1)
    expect(appSource).toContain("82564e10-5962-49df-8332-50e0c04c7485")
    expect(appSource).not.toContain("89771691-ddd3-439b-bf75-7b62c50c41c2")
  })

  it("keeps bearer tokens out of analytics, canonical metadata, and referrer headers", () => {
    const appSource = source("src/app.vue")
    const pageSource = source("src/pages/legal-review/[token].vue")
    const apiSource = source("server/api/legal-reviews/[token].get.ts")

    expect(appSource).toContain("route.path.startsWith(\"/legal-review/\")")
    expect(appSource).toContain("import.meta.env.PROD && !sensitiveBearerRoute.value")
    expect(appSource).toContain("if (sensitiveBearerRoute.value)")
    expect(appSource).toContain("return null")
    expect(pageSource).not.toContain("usePageSeo(")
    expect(pageSource).toContain("title: \"Agreement legal review\"")
    expect(pageSource).not.toContain("title: \"Agreement legal review · CoFoundry\"")
    expect(pageSource).toContain("noindex, nofollow")
    expect(pageSource).toContain("no-referrer")
    expect(apiSource).toContain("Referrer-Policy")
    expect(apiSource).toContain("private, no-store")
    expect(apiSource).toContain("projectContractLegalReviewForReviewer")
    expect(apiSource).not.toContain("review: context.review")
  })

  it("includes legal-review records in participant exports without exporting tokens", () => {
    const exportSource = source("server/api/account/export.get.ts")
    const persistenceSource = source("server/utils/contract-legal-reviews.ts")

    expect(exportSource).toContain("listContractLegalReviewsForContracts")
    expect(exportSource).toContain("contractLegalReviews,")
    expect(persistenceSource).not.toContain("inviteToken")
  })

  it("allows signed participants to create a superseding agreement version", () => {
    const contractPageSource = source("src/pages/app/contracts/[id].vue")

    expect(contractPageSource).toContain("workspaceStore.updateContractVersion")
    expect(contractPageSource).not.toContain("title: \"Signature already recorded\"")
    expect(contractPageSource).toContain("contract.status === \"signed\" ? \"Fully signed\" : \"Signature-ready\"")
  })
})
