import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import process from "node:process"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

const require = createRequire(import.meta.url)
const lintConfig = createRequire(require.resolve("@antfu/eslint-config"))
const pluginEntry = lintConfig.resolve("eslint-plugin-n")
const nodePlugin = createRequire(pluginEntry)

test("the Node lint plugin reads its supported JS-YAML 5 workspace format", async (context) => {
  const yaml = nodePlugin("js-yaml")
  assert.match(nodePlugin("js-yaml/package.json").version, /^5\./u)
  assert.deepEqual(yaml.load("packages:\n  - front-end\n  - back-end\n"), { packages: ["front-end", "back-end"] })
  assert.throws(() => yaml.load("value: 1\nvalue: 2\n"))
  assert.throws(() => yaml.load("value: !!js/function 'function () {}'"))
  const base = fileURLToPath(new URL("../.ai-work/runs/transitive-compatibility/", import.meta.url))
  await mkdir(base, { recursive: true })
  const directory = await mkdtemp(join(base, "yaml-"))
  context.after(() => rm(directory, { recursive: true }))
  await writeFile(join(directory, "pnpm-workspace.yaml"), "packages:\n  - front-end\n  - back-end\n")
  const helper = await import(pathToFileURL(join(dirname(pluginEntry), "util/get-pnpm-workspace-yaml.js")))
  assert.deepEqual(helper.getPnpmWorkspacePatterns(directory), ["front-end", "back-end"])
})

test("the beautifier CLI uses the installed glob API", async (context) => {
  const base = fileURLToPath(new URL("../.ai-work/runs/transitive-compatibility/", import.meta.url))
  await mkdir(base, { recursive: true })
  const directory = await mkdtemp(join(base, "glob-"))
  context.after(() => rm(directory, { recursive: true }))
  const filename = join(directory, "input.js")
  await writeFile(filename, "const answer=42;")
  const metadata = require("js-beautify/package.json")
  const binary = join(dirname(require.resolve("js-beautify/package.json")), metadata.bin["js-beautify"])
  execFileSync(process.execPath, [binary, "--replace", join(directory, "*.js")], { timeout: 30_000, maxBuffer: 1024 * 1024 })
  assert.match(await readFile(filename, "utf8"), /const answer = 42;/u)
})

test("the Markdown math consumer preserves rendering and untrusted-link rejection", async () => {
  const math = createRequire(lintConfig.resolve("micromark-extension-math"))
  const katex = math("katex")
  assert.match(katex.version, /^0\.19\./u)
  assert.match(katex.renderToString("\\frac{a}{b}", { displayMode: true }), /katex-display/u)
  assert.doesNotMatch(katex.renderToString("\\href{javascript:alert(1)}{text}", { trust: false, throwOnError: false }), /href="javascript:|<script/iu)
  const { micromark } = await import(pathToFileURL(lintConfig.resolve("micromark")))
  const { math: mathSyntax, mathHtml } = await import(pathToFileURL(lintConfig.resolve("micromark-extension-math")))
  assert.match(micromark("$a+b$", { extensions: [mathSyntax()], htmlExtensions: [mathHtml()] }), /class="katex/u)
})
