import assert from "node:assert/strict"
import { readFileSync, realpathSync } from "node:fs"
import { createRequire } from "node:module"
import test from "node:test"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const merge = require("deepmerge")

test("all locked deepmerge consumers use the guarded package", () => {
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"))
  const entries = Object.entries(lock.packages).filter(([name]) => name.endsWith("node_modules/deepmerge"))
  assert.ok(entries.length > 0)
  for (const [, entry] of entries)
    assert.equal(entry.resolved, "vendor/deepmerge")
  assert.equal(
    realpathSync(require.resolve("deepmerge")),
    fileURLToPath(new URL("../vendor/deepmerge/dist/cjs.js", import.meta.url)),
  )
})

test("prototype keys cannot poison source, target, nested or array results", () => {
  const payload = JSON.parse('{"__proto__":{"admin":true}}')
  const results = [
    merge(Object.create(null), payload),
    merge(payload, {}),
    merge({ session: null }, { session: payload }).session,
    merge({ session: 1 }, { session: payload }).session,
    merge({ session: undefined }, { session: payload }).session,
    merge({ session: payload }, {}).session,
    merge([], [payload])[0],
    merge.all([Object.create(null), payload]),
  ]
  for (const result of results) {
    assert.equal(Object.getPrototypeOf(result), Object.prototype)
    assert.equal(Object.hasOwn(result, "__proto__"), false)
    assert.equal(result.admin, undefined)
  }
  assert.equal({}.admin, undefined)
})

test("forbidden keys are omitted before invoking getters or custom hooks", () => {
  const payload = Object.defineProperty({}, "__proto__", {
    enumerable: true,
    get() { throw new Error("Forbidden getter was invoked") },
  })
  const customMerge = (key) => {
    assert.notEqual(key, "__proto__")
  }
  assert.deepEqual(merge(payload, {}, { customMerge }), {})
  assert.deepEqual(merge(Object.create(null), payload, { customMerge }), {})
})

test("ordinary merges preserve arrays, symbols, options and input values", () => {
  const identity = Symbol("identity")
  const target = { extensions: [".mjs"], nested: { first: 1 }, [identity]: "original" }
  const source = { extensions: [".js"], nested: { second: 2 }, [identity]: "updated" }
  const result = merge(target, source)
  assert.deepEqual(result, { extensions: [".mjs", ".js"], nested: { first: 1, second: 2 }, [identity]: "updated" })
  assert.deepEqual(target.extensions, [".mjs"])
  assert.notEqual(result.nested, target.nested)
  assert.equal(merge({}, source, { clone: false }).nested, source.nested)
  assert.deepEqual(merge(target, source, { arrayMerge: (_target, value) => value }).extensions, [".js"])
  assert.deepEqual(merge.all([{ first: 1 }, { second: 2 }]), { first: 1, second: 2 })
  assert.throws(() => merge.all({}), /first argument should be an array/)
})
