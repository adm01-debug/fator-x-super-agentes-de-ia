import { test, expect } from "../playwright-fixture";

test.describe("Deployments Page", () => {
  test("deployment page redirects unauthenticated users", async ({ page }) => {
    await page.goto("/deployments");
    await page.waitForURL(/\/auth/);
    await expect(page).toHaveURL(/\/auth/);
  });

  test("deployment page has correct title structure", async ({ page }) => {
    await page.goto("/deployments");
    // Should redirect to auth, verify auth page renders
    await expect(page.getByLabel("E-mail")).toBeVisible();
  });
});

test.describe("Workflows Page", () => {
  test("workflows page redirects unauthenticated users", async ({ page }) => {
    await page.goto("/workflows");
    await page.waitForURL(/\/auth/);
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe("Oracle Page", () => {
  test("oracle page redirects unauthenticated users", async ({ page }) => {
    await page.goto("/oracle");
    await page.waitForURL(/\/auth/);
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe("Monitoring Page", () => {
  test("monitoring page redirects unauthenticated users", async ({ page }) => {
    await page.goto("/monitoring");
    await page.waitForURL(/\/auth/);
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe("Knowledge Page", () => {
  test("knowledge page redirects unauthenticated users", async ({ page }) => {
    await page.goto("/knowledge");
    await page.waitForURL(/\/auth/);
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe("DataHub Page", () => {
  test("datahub page redirects unauthenticated users", async ({ page }) => {
    await page.goto("/datahub");
    await page.waitForURL(/\/auth/);
    await expect(page).toHaveURL(/\/auth/);
  });
});
