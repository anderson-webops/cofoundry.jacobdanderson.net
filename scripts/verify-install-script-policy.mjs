import { execFileSync } from "node:child_process"
import process from "node:process"

const npmExecPath = process.env.npm_execpath

if (!npmExecPath)
  throw new Error("Run install-script verification through npm so the selected npm executable is known.")

function runPendingCheck() {
  const env = { ...process.env }
  delete env.npm_config_global_ignore_file
  delete env.NPM_CONFIG_GLOBAL_IGNORE_FILE

  try {
    return execFileSync(process.execPath, [npmExecPath, "approve-scripts", "--allow-scripts-pending"], {
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })
  }
  catch (error) {
    const stdout = typeof error?.stdout === "string" ? error.stdout : ""
    const stderr = typeof error?.stderr === "string" ? error.stderr : ""
    const message = [stdout, stderr].filter(Boolean).join("\n").trim()
    throw new Error(message || "npm approve-scripts --allow-scripts-pending failed.")
  }
}

const output = runPendingCheck().trim()
const hasPendingInstallScripts = /\bpackages?\s+(?:has|have)\s+install\s+scripts\s+not\s+yet\s+covered\s+by\s+allowScripts\b/i.test(output)

if (/Unknown env config "global-ignore-file"/i.test(output))
  throw new Error("Install-script verification invoked npm with obsolete global-ignore-file configuration.")

if (hasPendingInstallScripts) {
  console.error(output)
  console.error("")
  console.error("Install-script policy failed: review the listed packages, then approve or deny them with npm approve-scripts/npm deny-scripts.")
  process.exit(1)
}

console.log(output || "Install-script policy passed: no unreviewed dependency install scripts.")
