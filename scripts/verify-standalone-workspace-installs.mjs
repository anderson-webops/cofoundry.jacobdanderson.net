import { spawnSync } from "node:child_process"
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
  const installOutput = run("npm", ["ci", "--workspaces=false", "--dry-run"], cwd)

  if (/\bnot\s+yet\s+covered\s+by\s+allowScripts\b/i.test(installOutput)) {
    process.stdout.write(installOutput)
    throw new Error(`${workspace.label} standalone install has unreviewed dependency install scripts.`)
  }

  run("npm", ["audit", "--workspaces=false", `--audit-level=${workspace.auditLevel}`], cwd)
  console.log(`${workspace.label} standalone npm ci dry-run and audit passed.`)
}
