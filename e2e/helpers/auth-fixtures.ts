/**
 * ═══════════════════════════════════════════════════════════════
 * Playwright Auth E2E — Synthetic User Fixtures
 * ═══════════════════════════════════════════════════════════════
 * Opt-in via SUPABASE_SERVICE_ROLE_KEY env var. When absent, tests
 * that depend on real auth self-skip with a clear message so CI
 * stays green even without secrets configured.
 *
 * Strategy: create a synthetic, email-confirmed user via service
 * role admin API, log in via UI with email+password (classic email
 * provider), then delete the user in afterAll. No OTP, no inbox,
 * no OAuth dependency.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY ??
  "";

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.EXTERNAL_SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  "";

const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXTERNAL_SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";

export const AUTH_E2E_ENABLED =
  Boolean(SERVICE_KEY) && Boolean(SUPABASE_URL) && Boolean(ANON_KEY);

export const AUTH_E2E_SKIP_REASON =
  "Auth E2E tests skipped — set SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_URL, SUPABASE_ANON_KEY) to enable.";

export interface E2EUser {
  id: string;
  email: string;
  password: string;
}

function getServiceClient(): SupabaseClient {
  if (!AUTH_E2E_ENABLED) {
    throw new Error("Service client requested but Auth E2E tests are not enabled.");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Create a synthetic, email-confirmed test user.
 * Uses the @e2e-tests.invalid TLD so synthetic users are easy to
 * identify and clean up in case afterAll hooks fail.
 */
export async function createE2EUser(prefix = "auth"): Promise<E2EUser> {
  const service = getServiceClient();
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e-tests.invalid`;
  const password = `E2E!${Math.random().toString(36).slice(2)}Aa1`;

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`createE2EUser failed: ${error?.message ?? "no user returned"}`);
  }

  return { id: data.user.id, email, password };
}

/** Delete the synthetic user. Safe to call even if creation partially failed. */
export async function deleteE2EUser(userId: string | undefined): Promise<void> {
  if (!userId || !AUTH_E2E_ENABLED) return;
  const service = getServiceClient();
  await service.auth.admin.deleteUser(userId).catch(() => {
    // Best-effort cleanup — never throw from afterAll.
  });
}

/**
 * Log in via the Auth UI (real browser flow).
 * Assumes the page is already on /auth.
 */
export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
}
