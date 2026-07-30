import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"

const outputDirectory = resolve(process.cwd(), "front-end/.output")
const localEnvPath = resolve(process.cwd(), ".env")
const secretNames = [
  "COFOUNDRY_OPERATIONS_TOKEN",
  "OPERATIONS_WORKER_TOKEN",
  "SESSION_SIGNING_SECRET",
  "NUXT_SESSION_SIGNING_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
]

if (existsSync(localEnvPath))
  process.loadEnvFile(localEnvPath)

if (!existsSync(outputDirectory)) {
  console.error("Build-secret verification failed: front-end/.output does not exist.")
  process.exit(1)
}

const secrets = secretNames.flatMap((name) => {
  const value = process.env[name]?.trim() || ""
  return value.length >= 16 ? [{ name, value: Buffer.from(value) }] : []
})

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  }))
  return nested.flat()
}

const findings = []
for (const path of await listFiles(outputDirectory)) {
  const contents = await readFile(path)
  for (const secret of secrets) {
    if (contents.includes(secret.value))
      findings.push({ name: secret.name, path })
  }
}

if (findings.length) {
  for (const finding of findings)
    console.error(`Build-secret verification failed: ${finding.name} was embedded in ${finding.path}.`)
  process.exit(1)
}

console.log(`Build-secret verification passed across ${secrets.length} configured private runtime value(s).`)
