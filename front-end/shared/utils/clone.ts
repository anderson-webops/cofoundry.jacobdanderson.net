export function cloneValue<T>(value: T): T {
  try {
    return structuredClone(value)
  }
  catch {
    if (value == null)
      return value

    return JSON.parse(JSON.stringify(value)) as T
  }
}
