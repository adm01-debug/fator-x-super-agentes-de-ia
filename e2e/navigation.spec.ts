import { test, expect } from "../playwright-fixture";

test.describe("Navigation & Routing", () => {
  test("auth page renders login form", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
  });

  test("protected routes redirect unauthenticated users", async ({ page }) => {
    const protectedRoutes = [
      "/agents",
      "/brain",
      "/oracle",
      "/knowledge",
      "/workflows",
      "/settings",
      "/security",
      "/billing",
      "/monitoring",
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL(/\/(auth)?$/, { timeout: 5000 });
      const url = page.url();
      expect(
        url.includes("/auth") || url.endsWith("/"),
        `Route ${route} should redirect to auth`
      ).toBeTruthy();
    }
  });

  test("404 page renders for unknown routes", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-123");
    await expect(page.getByText(/404|não encontrada|not found/i)).toBeVisible();
  });

  test("page has proper meta tags for SEO", async ({ page }) => {
    await page.goto("/auth");
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveCount(1);
    const content = await viewport.getAttribute("content");
    expect(content).toContain("width=device-width");
  });

  test("no JavaScript errors on auth page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/auth");
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });
});

test.describe("Responsive Design", () => {
  test("auth page renders on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/auth");
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });
});
