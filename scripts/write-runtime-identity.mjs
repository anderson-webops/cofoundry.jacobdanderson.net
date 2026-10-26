import { closeSync, fchmodSync, openSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import process from "node:process"

const [targetArg, commitSha, release, deployedAt] = process.argv.slice(2)
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
const expectedRelease = `v${packageJson.version}`

if (!targetArg)
  throw new Error("Pass the staged runtime directory.")
if (!/^[0-9a-f]{40}$/.test(commitSha || ""))
  throw new Error("Runtime identity requires an exact 40-character Git commit.")
if (release !== expectedRelease)
  throw new Error(`Runtime release must match package version ${expectedRelease}.`)
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(deployedAt || "") || !Number.isFinite(Date.parse(deployedAt)))
  throw new Error("Runtime identity requires a valid UTC deployment timestamp.")

const target = resolve(targetArg, ".cofoundry-release-prepared.json")
const identity = openSync(target, "wx", 0o600)
try {
  writeFileSync(identity, `${JSON.stringify({ commitSha, deployedAt, release }, null, 2)}\n`)
  fchmodSync(identity, 0o644)
}
finally {
  closeSync(identity)
}
