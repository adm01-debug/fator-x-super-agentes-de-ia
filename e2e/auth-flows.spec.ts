/**
 * ═══════════════════════════════════════════════════════════════
 * Auth E2E Flows — Real login/logout/protected-route coverage
 * ═══════════════════════════════════════════════════════════════
 * Uses synthetic users created via service role. Self-skips when
 * SUPABASE_SERVICE_ROLE_KEY is not configured (local dev / public PRs).
 *
 * Complements `e2e/auth.spec.ts` which covers UI-only validation.
 */
import { test, expect } from "../playwright-fixture";
import {
  AUTH_E2E_ENABLED,
  AUTH_E2E_SKIP_REASON,
  createE2EUser,
  deleteE2EUser,
  loginViaUI,
  type E2EUser,
} from "./helpers/auth-fixtures";
import { expectNoA11yViolations } from "./helpers/a11y";

test.describe("Auth Flows (synthetic user)", () => {
  test.skip(!AUTH_E2E_ENABLED, AUTH_E2E_SKIP_REASON);

  let user: E2EUser | undefined;

  test.beforeAll(async () => {
    user = await createE2EUser("auth-flow");
  });

  test.afterAll(async () => {
    await deleteE2EUser(user?.id);
  });

  test("login válido redireciona para área autenticada", async ({ page }) => {
    if (!user) throw new Error("user fixture missing");
    await page.goto("/auth");
    await loginViaUI(page, user.email, user.password);

    // Aguarda redirect para fora de /auth (dashboard, agents, ou home autenticado)
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 15_000 });
    expect(page.url()).not.toContain("/auth");
  });

  test("login inválido mantém usuário em /auth com mensagem de erro", async ({ page }) => {
    if (!user) throw new Error("user fixture missing");
    await page.goto("/auth");
    await loginViaUI(page, user.email, "senha-errada-propositalmente-123");

    // Permanece em /auth (não redireciona)
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/auth");

    // Algum feedback de erro deve aparecer (toast ou inline)
    const errorVisible = await page
      .getByText(/credenciais|inválid|incorret|erro|invalid/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(errorVisible).toBe(true);
  });

  test("rota protegida sem auth redireciona para /auth", async ({ page }) => {
    // Garante context limpo
    await page.context().clearCookies();
    await page.goto("/agents");
    await page.waitForURL(/\/auth/, { timeout: 10_000 });
    expect(page.url()).toContain("/auth");
  });

  test("sessão persiste após reload", async ({ page }) => {
    if (!user) throw new Error("user fixture missing");
    await page.goto("/auth");
    await loginViaUI(page, user.email, user.password);
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 15_000 });

    const urlBeforeReload = page.url();
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Após reload, NÃO deve voltar para /auth
    expect(page.url()).not.toContain("/auth");
    expect(new URL(page.url()).pathname).toBe(new URL(urlBeforeReload).pathname);
  });

  test("logout limpa sessão e volta para /auth", async ({ page }) => {
    if (!user) throw new Error("user fixture missing");
    await page.goto("/auth");
    await loginViaUI(page, user.email, user.password);
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 15_000 });

    // Procura botão de logout — pode estar em menu de usuário
    const logoutButton = page.getByRole("button", { name: /sair|logout/i }).first();
    const menuTrigger = page.getByRole("button", { name: /perfil|usuário|conta|menu/i }).first();

    if (!(await logoutButton.isVisible().catch(() => false))) {
      // Tenta abrir menu de usuário primeiro
      await menuTrigger.click().catch(() => undefined);
      await page.waitForTimeout(500);
    }

    await page.getByRole("button", { name: /sair|logout/i }).first().click();
    await page.waitForURL(/\/auth/, { timeout: 10_000 });
    expect(page.url()).toContain("/auth");
  });
});
