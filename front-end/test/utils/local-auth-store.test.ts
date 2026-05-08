import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  clearLocalAuthStoreForTests,
  createLocalAuthAccount,
  findLocalAuthSessionByEmail,
  findLocalAuthSessionById,
  updateLocalAuthOnboarding,
  verifyLocalAuthCredentials,
} from "../../server/utils/local-auth-store"

let dataDirectory: string

describe("local auth account store", () => {
  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-local-auth-"))
    process.env.COFOUNDRY_LOCAL_DATA_DIR = dataDirectory
    await clearLocalAuthStoreForTests()
  })

  afterEach(async () => {
    await clearLocalAuthStoreForTests()
    await rm(dataDirectory, { force: true, recursive: true })
    delete process.env.COFOUNDRY_LOCAL_DATA_DIR
  })

  it("persists invited account credentials and onboarding state", async () => {
    const created = await createLocalAuthAccount({
      email: "invited@example.com",
      name: "Invited Founder",
      password: "founder123",
    })

    expect(created).toMatchObject({
      email: "invited@example.com",
      name: "Invited Founder",
      onboardingCompleted: false,
      role: "founder",
    })

    const duplicate = await createLocalAuthAccount({
      email: "INVITED@example.com",
      name: "Duplicate Founder",
      password: "founder123",
    })
    expect(duplicate).toBeNull()

    const verified = await verifyLocalAuthCredentials("invited@example.com", "founder123")
    expect(verified?.id).toBe(created?.id)

    const rejected = await verifyLocalAuthCredentials("invited@example.com", "wrong-password")
    expect(rejected).toBeNull()

    const byEmail = await findLocalAuthSessionByEmail("INVITED@example.com")
    const byId = await findLocalAuthSessionById(created!.id)
    expect(byEmail?.id).toBe(created?.id)
    expect(byId?.email).toBe("invited@example.com")

    const updated = await updateLocalAuthOnboarding({
      ...created!,
      name: "Updated Founder",
      onboardingCompleted: true,
    })

    expect(updated).toMatchObject({
      name: "Updated Founder",
      onboardingCompleted: true,
    })
  })
})
