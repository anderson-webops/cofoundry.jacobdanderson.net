export function useRuntimeConfig(...parameters: unknown[]) {
  const provider = Reflect.get(globalThis, "useRuntimeConfig")
  if (typeof provider !== "function")
    throw new TypeError("This test requires an explicit runtime configuration fixture.")
  return Reflect.apply(provider, undefined, parameters)
}
