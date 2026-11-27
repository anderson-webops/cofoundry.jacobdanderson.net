import { defineEventHandler, setHeader } from "h3"
import { workspaceSeed } from "../../../shared/data/seed"
import { buildPublicDirectorySnapshot } from "../../../shared/utils/directory"

const publicDirectory = buildPublicDirectorySnapshot(workspaceSeed)

export default defineEventHandler((event) => {
  setHeader(event, "Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400")
  return publicDirectory
})
