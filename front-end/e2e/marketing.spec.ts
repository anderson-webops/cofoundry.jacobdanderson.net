import { expect, test } from "@playwright/test"

test("marketing homepage loads the core CoFoundry pitch", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByText("Founder matching for startup teams")).toBeVisible()
  await expect(page.getByRole("heading", { name: /find the people you can build a company with/i })).toBeVisible()
  await expect(page.getByText("From intro to agreement", { exact: true })).toBeVisible()
  await expect(page.locator("main")).toContainText("Profiles, intros, trial sprints, proposals, and agreements follow one clear sequence.")
  await expect(page.getByRole("link", { name: /see how it works/i })).toBeVisible()
})

test("sign in page exposes intentional workspace access", async ({ page }) => {
  await page.goto("/auth/sign-in")

  await expect(page.getByRole("heading", { name: /sign in to an existing workspace/i })).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Password")).toBeVisible()
  await expect(page.locator("button[type=\"submit\"]")).toBeEnabled()
  await expect(page.getByRole("link", { name: /request access/i })).toBeVisible()
})

test("public founder directory page exposes role-first browsing", async ({ page }) => {
  await page.goto("/find-cofounder")

  await expect(page.getByRole("heading", { name: /browse founders, cofounders, and startup searches by role, stage, and market/i })).toBeVisible()
  await expect(page.getByText("Public founder directory", { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: /view all hubs/i })).toBeVisible()
})
