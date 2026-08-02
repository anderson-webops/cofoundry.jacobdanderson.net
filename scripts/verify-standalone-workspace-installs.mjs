import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import process from "node:process"

const repoRoot = new URL("..", import.meta.url)

const standaloneWorkspaces = [
  {
    auditLevel: "high",
    dir: "back-end",
    label: "back-end",
  },
]

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
  })

  const output = [result.stdout, result.stderr].filter(Boolean).join("")

  if (result.status !== 0) {
    process.stdout.write(output)
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`)
  }

  return output
}

for (const workspace of standaloneWorkspaces) {
  const cwd = new URL(`${workspace.dir}/`, `${repoRoot}/`)
  const manifest = JSON.parse(readFileSync(new URL("package.json", cwd), "utf8"))

  if (Object.hasOwn(manifest, "allowScripts"))
    throw new Error(`${workspace.label} must inherit install-script policy from the monorepo root; npm ignores allowScripts in workspace manifests.`)

  for (const nestedConfig of ["package-lock.json", ".npmrc"]) {
    if (existsSync(new URL(nestedConfig, cwd)))
      throw new Error(`${workspace.label}/${nestedConfig} must not duplicate the monorepo root install contract.`)
  }

  const installOutput = run("npm", ["ci", "--workspace", workspace.dir, "--omit=dev", "--dry-run"], repoRoot)

  if (/\bnot\s+yet\s+covered\s+by\s+allowScripts\b/i.test(installOutput)) {
    process.stdout.write(installOutput)
    throw new Error(`${workspace.label} standalone install has unreviewed dependency install scripts.`)
  }

  if (/\ballowScripts in workspace\b.*\bis ignored\b/i.test(installOutput)) {
    process.stdout.write(installOutput)
    throw new Error(`${workspace.label} standalone install emitted an ignored workspace install-script policy warning.`)
  }

  run("npm", ["audit", "--workspace", workspace.dir, "--omit=dev", `--audit-level=${workspace.auditLevel}`], repoRoot)
  console.log(`${workspace.label} production-only root-lock workspace install and audit passed.`)
}
