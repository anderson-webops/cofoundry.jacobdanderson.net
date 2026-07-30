let localAdminSecurityQueue = Promise.resolve()

export async function withLocalAdminSecurityLock<T>(work: () => Promise<T> | T) {
  const run = localAdminSecurityQueue.then(work)
  localAdminSecurityQueue = run.then(() => undefined, () => undefined)
  return run
}
