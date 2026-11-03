import { setHeader } from "h3"
import { readServerDeploymentMetadata } from "../utils/deployment-metadata"

export default defineEventHandler((event) => {
  setHeader(event, "Cache-Control", "no-store")
  setHeader(event, "X-Robots-Tag", "noindex, nofollow")

  const deployment = readServerDeploymentMetadata(event)

  return {
    schemaVersion: 1,
    site: "cofoundry.jacobdanderson.net",
    version: deployment.release.replace(/^v/, ""),
    commit: deployment.commitSha,
    tag: deployment.release,
    status: "selected",
    generatedAt: new Date().toISOString(),
  }
})
