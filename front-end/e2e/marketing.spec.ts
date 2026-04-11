import { expect, test } from "@playwright/test"

test("marketing homepage loads the core CoFoundry pitch", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByText("Founder matching for serious builders")).toBeVisible()
  await expect(page.getByRole("heading", { name: /find the people you can build a company with/i })).toBeVisible()
  await expect(page.getByText("Formation workflow", { exact: true })).toBeVisible()
  await expect(page.locator("main")).toContainText("CoFoundry is built for founder relationships, not freelance gigs.")
  await expect(page.getByRole("link", { name: /browse public directory/i })).toBeVisible()
})

test("sign in page exposes the seeded local auth flow", async ({ page }) => {
  await page.goto("/auth/sign-in")

  await expect(page.getByRole("heading", { name: /pick up the founder conversation where you left it/i })).toBeVisible()
  await expect(page.locator("input[type=\"email\"]")).toHaveValue(/@cofoundry\.dev$/)
  await expect(page.locator("button[type=\"submit\"]")).toBeEnabled()
  await expect(page.getByText("Demo accounts", { exact: true })).toBeVisible()
})

test("public founder directory page exposes role-first browsing", async ({ page }) => {
  await page.goto("/find-cofounder")

  await expect(page.getByRole("heading", { name: /search startup team formation by role, stage, and company shape/i })).toBeVisible()
  await expect(page.getByText("Public founder directory", { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: /view all role hubs/i })).toBeVisible()
})
