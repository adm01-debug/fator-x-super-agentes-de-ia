import { test, expect } from "../playwright-fixture";

test.describe("Agent Builder (unauthenticated)", () => {
  test("redirects to auth when not logged in", async ({ page }) => {
    await page.goto("/agent-builder");
    // Should redirect to auth page since user is not authenticated
    await page.waitForURL(/\/(auth)?$/);
    // Either shows auth page or stays on landing
    const url = page.url();
    expect(url.includes("/auth") || url.endsWith("/")).toBeTruthy();
  });
});

test.describe("Landing Page", () => {
  test("renders the landing page", async ({ page }) => {
    await page.goto("/");
    // Landing page should render without CSP errors
    await expect(page.locator("body")).toBeVisible();
  });

  test("has no CSP violation errors in console", async ({ page }) => {
    const cspErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("Content-Security-Policy") || msg.text().includes("CSP")) {
        cspErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      if (err.message.includes("CSP")) {
        cspErrors.push(err.message);
      }
    });

    await page.goto("/");
    await page.waitForTimeout(2000);
    expect(cspErrors).toHaveLength(0);
  });
});

test.describe("Navigation", () => {
  test("404 page renders for unknown routes", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByText(/404|não encontrada|not found/i)).toBeVisible();
  });
});

test.describe("Agents Page (unauthenticated)", () => {
  test("redirects unauthenticated users", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForURL(/\/(auth)?$/);
    const url = page.url();
    expect(url.includes("/auth") || url.endsWith("/")).toBeTruthy();
  });
});
