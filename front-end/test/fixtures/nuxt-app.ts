export { useRuntimeConfig } from "./nuxt-runtime"

export function useCookie(...parameters: unknown[]) {
  const provider = Reflect.get(globalThis, "useCookie")
  if (typeof provider !== "function")
    throw new TypeError("This test requires an explicit cookie fixture.")
  return Reflect.apply(provider, undefined, parameters)
}

export function useState(...parameters: unknown[]) {
  const provider = Reflect.get(globalThis, "useState")
  if (typeof provider !== "function")
    throw new TypeError("This test requires an explicit session-state fixture.")
  return Reflect.apply(provider, undefined, parameters)
}
