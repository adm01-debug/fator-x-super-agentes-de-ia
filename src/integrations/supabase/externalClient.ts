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

// Fallback: if external vars are missing, use the local Lovable Cloud DB
const FALLBACK_URL = import.meta.env.VITE_SUPABASE_URL;
const FALLBACK_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const resolvedUrl = EXTERNAL_SUPABASE_URL || FALLBACK_URL;
const resolvedKey = EXTERNAL_SUPABASE_ANON_KEY || FALLBACK_KEY;

if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SUPABASE_ANON_KEY) {
  console.warn(
    '⚠️ VITE_EXTERNAL_SUPABASE_URL or VITE_EXTERNAL_SUPABASE_ANON_KEY not set.',
    'Falling back to Lovable Cloud DB. Set them in Lovable environment settings to use the external DB.'
  );
}

/**
 * External Supabase client for ALL data operations.
 * Falls back to Lovable Cloud DB when external vars are not configured.
 */
export const supabaseExternal = createClient<Database>(
  resolvedUrl,
  resolvedKey,
  {
    auth: {
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
