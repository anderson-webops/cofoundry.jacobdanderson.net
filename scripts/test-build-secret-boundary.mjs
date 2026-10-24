import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import process from "node:process"
import { test } from "node:test"

const projectRoot = resolve(import.meta.dirname, "..")
const scratchRoot = join(projectRoot, ".ai-work", "runs")
const verifier = join(import.meta.dirname, "verify-build-secret-boundary.mjs")
const syntheticSecret = "synthetic-private-value-123"

async function withOutput(callback) {
  await mkdir(scratchRoot, { recursive: true })
  const directory = await mkdtemp(join(scratchRoot, "build-secret-boundary-"))
  const output = join(directory, "front-end", ".output")
  await mkdir(output, { recursive: true })
  try {
    await callback({ directory, output })
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function verify(directory) {
  return spawnSync(process.execPath, [verifier], {
    cwd: directory,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      COFOUNDRY_OPERATIONS_TOKEN: syntheticSecret,
    },
  })
}

test("internal build links preserve complete secret scanning", async () => {
  await withOutput(async ({ directory, output }) => {
    const target = join(output, "server")
    await mkdir(target)
    await writeFile(join(target, "index.mjs"), "export default 'safe'\n")
    await symlink("server", join(output, "server-link"))
    assert.equal(verify(directory).status, 0)

    await writeFile(join(target, "index.mjs"), syntheticSecret)
    const rejected = verify(directory)
    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stderr, /COFOUNDRY_OPERATIONS_TOKEN/u)
    assert.doesNotMatch(rejected.stderr, /synthetic-private-value-123/u)
  })
})

test("external and cyclic build links fail closed", async () => {
  await withOutput(async ({ directory, output }) => {
    const external = join(directory, "external")
    await mkdir(external)
    await writeFile(join(external, "file.mjs"), "safe\n")
    await symlink(external, join(output, "external-link"))
    assert.notEqual(verify(directory).status, 0)

    await rm(join(output, "external-link"))
    const nested = join(output, "nested")
    await mkdir(nested)
    await symlink("..", join(nested, "ancestor-link"))
    assert.notEqual(verify(directory).status, 0)
  })
})
