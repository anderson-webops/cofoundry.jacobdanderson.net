import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import process from "node:process"

const canonicalRoot = "front-end/shared"
const shimRoot = "front-end/src/shared"
const allowedDirectCopies = new Set([
  "utils/oauth-providers.ts",
])

function walk(dir) {
  const entries = []

  for (const name of readdirSync(dir)) {
    const path = join(dir, name)

    if (statSync(path).isDirectory()) {
      entries.push(...walk(path))
    }
    else {
      entries.push(path)
    }
  }

  return entries
}

function normalizePath(value) {
  return value.split(sep).join("/")
}

function normalizeContent(value) {
  return value.replace(/\r\n/g, "\n").trim()
}

function expectedShim(relPath) {
  return `export * from "#shared/${relPath.replace(/\.ts$/, "")}"`
}

function relativeShim(relPath) {
  const depth = relPath.split("/").length - 1
  const prefix = Array.from({ length: depth + 2 }, () => "..").join("/")
  return `export * from "${prefix}/shared/${relPath.replace(/\.ts$/, "")}"`
}

const canonicalFiles = walk(canonicalRoot)
  .map(path => normalizePath(relative(canonicalRoot, path)))
  .sort()
const shimFiles = walk(shimRoot)
  .map(path => normalizePath(relative(shimRoot, path)))
  .sort()
const canonicalSet = new Set(canonicalFiles)
const shimSet = new Set(shimFiles)
const problems = []

for (const relPath of canonicalFiles) {
  if (!shimSet.has(relPath)) {
    problems.push(`Missing src/shared shim for ${relPath}`)
    continue
  }

  const canonicalContent = normalizeContent(readFileSync(join(canonicalRoot, relPath), "utf8"))
  const shimContent = normalizeContent(readFileSync(join(shimRoot, relPath), "utf8"))
  const allowedShims = new Set([
    expectedShim(relPath),
    relativeShim(relPath),
  ])

  if (allowedShims.has(shimContent))
    continue

  if (allowedDirectCopies.has(relPath) && shimContent === canonicalContent)
    continue

  problems.push(`Unexpected src/shared implementation for ${relPath}; use ${JSON.stringify(expectedShim(relPath))} or document an exception.`)
}

for (const relPath of shimFiles) {
  if (!canonicalSet.has(relPath))
    problems.push(`src/shared file has no canonical shared counterpart: ${relPath}`)
}

if (problems.length > 0) {
  console.error("Shared shim verification failed:")
  for (const problem of problems)
    console.error(`- ${problem}`)
  process.exit(1)
}

console.log(`Shared shim verification passed for ${canonicalFiles.length} files.`)
