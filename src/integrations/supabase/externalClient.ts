/**
 * Nexus Agents Studio — External Supabase Client
 * 
 * This client connects to the EXTERNAL Supabase database (tdprnylgyrogbbhgdoik)
 * where all application data lives.
 * 
 * The original `supabase` client (client.ts) is used ONLY for authentication.
 * All data operations (agents, traces, workspaces, etc.) go through this client.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const EXTERNAL_SUPABASE_URL = import.meta.env.VITE_EXTERNAL_SUPABASE_URL;
const EXTERNAL_SUPABASE_ANON_KEY = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY;

if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SUPABASE_ANON_KEY) {
  console.error(
    '🔴 Missing VITE_EXTERNAL_SUPABASE_URL or VITE_EXTERNAL_SUPABASE_ANON_KEY.',
    'Set them in your .env or Lovable environment settings.'
  );
}

/**
 * External Supabase client for ALL data operations.
 * Auth tokens from the local Lovable Cloud client are forwarded
 * so RLS policies on the external DB can validate the user.
 */
export const supabaseExternal = createClient<Database>(
  EXTERNAL_SUPABASE_URL || '',
  EXTERNAL_SUPABASE_ANON_KEY || '',
  {
    auth: {
      // We do NOT persist auth here — auth is handled by the local client.
      // This client inherits the session from the local client via accessToken.
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Set the access token on the external client so RLS works.
 * Call this after login or when the session changes.
 */
export async function syncExternalAuth(accessToken: string) {
  await supabaseExternal.auth.setSession({
    access_token: accessToken,
    refresh_token: '', // Not needed — local client manages refresh
  });
}
