import { test, expect } from "../playwright-fixture";

test.describe("Auth Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
  });

  test("renders login form with all required elements", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Fator X" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });

  test("shows validation errors for empty fields", async ({ page }) => {
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByText("E-mail é obrigatório")).toBeVisible();
    await expect(page.getByText("Senha é obrigatória")).toBeVisible();
  });

  test("shows email validation error for invalid email", async ({ page }) => {
    await page.getByLabel("E-mail").fill("invalid-email");
    await page.getByLabel("Senha").fill("password123");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByText("E-mail inválido")).toBeVisible();
  });

  test("toggles between login and signup", async ({ page }) => {
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
    await page.getByRole("button", { name: /criar conta/i }).click();
    await expect(page.getByRole("button", { name: /criar conta/i }).first()).toBeVisible();
    await expect(page.getByText("Já tem conta?")).toBeVisible();
  });

  test("shows password strength indicator on signup", async ({ page }) => {
    await page.getByRole("button", { name: /criar conta/i }).click();
    await page.getByLabel("Senha").fill("Abc12345");
    await expect(page.getByText("Mínimo 8 caracteres")).toBeVisible();
    await expect(page.getByText("Letra maiúscula")).toBeVisible();
    await expect(page.getByText("Letra minúscula")).toBeVisible();
    await expect(page.getByText("Número")).toBeVisible();
  });

  test("shows forgot password form", async ({ page }) => {
    await page.getByRole("button", { name: /esqueceu a senha/i }).click();
    await expect(page.getByText("Informe seu e-mail para recuperar a senha")).toBeVisible();
    await expect(page.getByRole("button", { name: /enviar link de recuperação/i })).toBeVisible();
  });

  test("password visibility toggle works", async ({ page }) => {
    const passwordInput = page.getByLabel("Senha");
    await passwordInput.fill("mypassword");
    await expect(passwordInput).toHaveAttribute("type", "password");
    await page.getByLabel("Mostrar senha").click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await page.getByLabel("Ocultar senha").click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });
});
