import { expect, test } from "@playwright/test"

test("homepage exposes the service and access paths", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: /find the people you can build a company with/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /see how it works/i })).toBeVisible()
  await expect(page.locator("main a[href=\"/auth/sign-up?source=home-hero\"]")).toBeVisible()
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
  await expect(page.getByRole("link", { name: /browse public profiles/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /view all hubs/i })).toBeVisible()
})

test("loads dedicated analytics under CSP and blocks inline event handlers", async ({ page }) => {
  let analyticsRequests = 0
  await page.route("https://analytics.cofoundry.jacobdanderson.net/script.js", async (route) => {
    analyticsRequests += 1
    await route.fulfill({
      contentType: "application/javascript",
      body: "window.__cofoundryAnalyticsLoaded = true",
    })
  })

  await page.goto("/")
  await expect.poll(() => page.evaluate(() => Boolean(Reflect.get(window, "__cofoundryAnalyticsLoaded")))).toBe(true)
  expect(analyticsRequests).toBe(1)

  const inlineHandlerRan = await page.evaluate(() => {
    const button = document.createElement("button")
    button.setAttribute("onclick", "window.__cofoundryInlineHandlerRan = true")
    document.body.appendChild(button)
    button.click()
    button.remove()
    return Boolean(Reflect.get(window, "__cofoundryInlineHandlerRan"))
  })
  expect(inlineHandlerRan).toBe(false)
})
