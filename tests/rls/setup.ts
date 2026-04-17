/**
 * ═══════════════════════════════════════════════════════════════
 * RLS Persona Tests — Shared Setup Helpers
 * ═══════════════════════════════════════════════════════════════
 * Opt-in via SUPABASE_SERVICE_ROLE_KEY env var. When absent, the
 * test suites self-skip with a clear message so CI stays green.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY ??
  '';

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.EXTERNAL_SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  '';

const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXTERNAL_SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  '';

export const RLS_TESTS_ENABLED =
  Boolean(SERVICE_KEY) && Boolean(SUPABASE_URL) && Boolean(ANON_KEY);

export const RLS_SKIP_REASON =
  'RLS tests skipped — set SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_URL, SUPABASE_ANON_KEY) to enable.';

export interface TestUser {
  id: string;
  email: string;
  jwt: string;
  client: SupabaseClient;
}

export function getServiceClient(): SupabaseClient {
  if (!RLS_TESTS_ENABLED) {
    throw new Error('Service client requested but RLS tests not enabled.');
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getAuthedClient(jwt: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

/** Create a synthetic, email-confirmed test user and return an authed client. */
export async function createTestUser(emailPrefix: string): Promise<TestUser> {
  const service = getServiceClient();
  const email = `${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@rls-tests.invalid`;
  const password = `Test!${Math.random().toString(36).slice(2)}Aa1`;

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`createTestUser failed: ${createErr?.message ?? 'no user'}`);
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({ email, password });
  if (signErr || !signIn.session) {
    throw new Error(`signIn failed: ${signErr?.message ?? 'no session'}`);
  }

  return {
    id: created.user.id,
    email,
    jwt: signIn.session.access_token,
    client: getAuthedClient(signIn.session.access_token),
  };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const service = getServiceClient();
  await service.auth.admin.deleteUser(userId).catch(() => undefined);
}
