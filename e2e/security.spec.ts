import { test, expect } from "../playwright-fixture";

test.describe("Security Headers", () => {
  test("CSP meta tag is present", async ({ page }) => {
    await page.goto("/");
    const cspMeta = page.locator('meta[http-equiv="Content-Security-Policy"]');
    await expect(cspMeta).toHaveCount(1);
    const content = await cspMeta.getAttribute("content");
    expect(content).toContain("default-src 'self'");
    expect(content).toContain("frame-ancestors 'none'");
  });

  test("X-Frame-Options meta tag is present", async ({ page }) => {
    await page.goto("/");
    const xframeMeta = page.locator('meta[http-equiv="X-Frame-Options"]');
    await expect(xframeMeta).toHaveCount(1);
    const content = await xframeMeta.getAttribute("content");
    expect(content).toBe("DENY");
  });

  test("Referrer policy meta tag is present", async ({ page }) => {
    await page.goto("/");
    const referrerMeta = page.locator('meta[name="referrer"]');
    await expect(referrerMeta).toHaveCount(1);
    const content = await referrerMeta.getAttribute("content");
    expect(content).toBe("strict-origin-when-cross-origin");
  });

  test("Permissions-Policy meta tag is present", async ({ page }) => {
    await page.goto("/");
    const permMeta = page.locator('meta[http-equiv="Permissions-Policy"]');
    await expect(permMeta).toHaveCount(1);
    const content = await permMeta.getAttribute("content");
    expect(content).toContain("camera=()");
    expect(content).toContain("microphone=()");
  });

  test("no inline scripts violate CSP", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("Content-Security-Policy")) {
        violations.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForTimeout(1500);
    // We allow 'unsafe-inline' for Vite dev, so no violations expected
    expect(violations).toHaveLength(0);
  });
});
