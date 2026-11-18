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

test("Nuxt DevTools 4 uses the current 0.8 host without rebinding legacy Vue plugin peers", () => {
  const frontend = createRequire(new URL("../front-end/package.json", import.meta.url))
  const devtools = createRequire(frontend.resolve("@nuxt/devtools"))
  const legacy = createRequire(devtools.resolve("vite-plugin-vue-devtools"))
  assert.match(frontend("@nuxt/devtools/package.json").version, /^4\./u)
  assert.equal(legacy("vite-plugin-vue-devtools/package.json").version, "9.0.0-rc.3")
  for (const name of ["@vitejs/devtools", "@vitejs/devtools-kit"]) {
    assert.equal(frontend(`${name}/package.json`).version, "0.8.3")
    assert.equal(devtools(`${name}/package.json`).version, "0.8.3")
    assert.match(legacy(`${name}/package.json`).version, /^0\.7\./u)
    assert.notEqual(legacy.resolve(name), devtools.resolve(name))
  }
})

test("the backend runs TypeScript 7 while Vue retains its required compiler API", () => {
  const frontend = createRequire(new URL("../front-end/package.json", import.meta.url))
  const backend = createRequire(new URL("../back-end/package.json", import.meta.url))
  assert.equal(typeof frontend("typescript").createProgram, "function")
  assert.equal(typeof frontend("typescript").createSourceFile, "function")
  assert.match(backend("typescript").version, /^7\./u)
  for (const scope of [frontend, backend])
    assert.match(scope("@types/node/package.json").version, /^26\./u)
  const metadataPath = backend.resolve("typescript/package.json")
  const compiler = join(dirname(metadataPath), backend("typescript/package.json").bin.tsc)
  assert.match(execFileSync(process.execPath, [compiler, "--version"], { encoding: "utf8", timeout: 30_000 }), /Version 7\./u)
})

test("the Node lint plugin reads its supported JS-YAML 5 workspace format", async (context) => {
  const yaml = nodePlugin("js-yaml")
  assert.match(nodePlugin("js-yaml/package.json").version, /^5\./u)
  assert.deepEqual(yaml.load("packages:\n  - front-end\n  - back-end\n"), {
    packages: ["front-end", "back-end"]
  })
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
  execFileSync(process.execPath, [
    binary,
    "--replace",
    join(directory, "*.js")
  ], { timeout: 30_000, maxBuffer: 1024 * 1024 })
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
  assert.match(micromark("$a+b$", {
    extensions: [
      mathSyntax()
    ],
    htmlExtensions: [
      mathHtml()
    ]
  }), /class="katex/u)
})
