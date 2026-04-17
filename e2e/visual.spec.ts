/**
 * ═══════════════════════════════════════════════════════════════
 * Visual regression baseline — pixel-diff guard
 * ═══════════════════════════════════════════════════════════════
 * Captures screenshots of public/critical screens and compares
 * against committed baselines in e2e/__screenshots__/.
 *
 * Update baselines intentionally:
 *   npm run test:e2e:update
 *
 * Tolerance: 1% pixel diff (anti-aliasing safe). See playwright.config.ts.
 */
import { test, expect } from "../playwright-fixture";

test.describe("Visual regression — public screens", () => {
  test("auth page — desktop 1280x720", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");
    // Wait one frame for animations to settle
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot("auth-desktop.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("auth page — mobile 375x667", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot("auth-mobile.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("auth page — signup variant", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /criar conta/i }).click();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot("auth-signup-desktop.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("protected route redirects to /auth", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/agents");
    // Should redirect to /auth (AuthGuard) — capture final state
    await page.waitForURL(/\/auth/, { timeout: 5000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot("auth-after-redirect.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});
