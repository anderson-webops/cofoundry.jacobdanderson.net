import { existsSync } from "node:fs"
import { lstat, readdir, readFile, realpath } from "node:fs/promises"
import { resolve, sep } from "node:path"
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
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isSymbolicLink()) {
      const target = await realpath(path)
      if (!target.startsWith(`${outputRoot}${sep}`) || path.startsWith(`${target}${sep}`))
        throw new Error(`Build-secret verification failed: symlink escapes build output: ${path}`)
      return []
    }
    if (entry.isDirectory())
      return listFiles(path)
    if (!entry.isFile())
      throw new Error(`Build-secret verification failed: unsupported build object: ${path}`)
    return [path]
  }))
  return nested.flat()
}

if (!(await lstat(outputDirectory)).isDirectory())
  throw new Error("Build-secret verification failed: build output is not a real directory.")
const outputRoot = await realpath(outputDirectory)
const findings = []
for (const path of await listFiles(outputRoot)) {
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
