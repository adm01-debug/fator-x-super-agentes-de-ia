/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Shared Auth Helper
 * ═══════════════════════════════════════════════════════════════
 * Centralized authentication for Supabase Edge Functions.
 * Eliminates duplicated auth boilerplate across 19 functions.
 *
 * Usage:
 *   import { authenticateRequest, createSupabaseClients } from "../_shared/auth.ts";
 *
 *   // Quick auth (user required):
 *   const auth = await authenticateRequest(req);
 *   if (auth.error) return auth.error; // Returns 401 Response
 *   const { user, supabase, supabaseAdmin } = auth;
 *
 * Pattern: Dify workspace auth + Mastra API key validation
 * ═══════════════════════════════════════════════════════════════
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { errorResponse } from "./cors.ts";

// ═══ Types ═══

export interface AuthResult {
  user: {
    id: string;
    email?: string;
    role?: string;
  };
  supabase: SupabaseClient;
  supabaseAdmin: SupabaseClient;
  workspaceId: string | null;
  error: null;
}

export interface AuthError {
  user: null;
  supabase: null;
  supabaseAdmin: null;
  workspaceId: null;
  error: Response;
}

export type AuthResponse = AuthResult | AuthError;

// ═══ Supabase Client Factory ═══

/**
 * Create both user-scoped and admin Supabase clients.
 * User client respects RLS. Admin client bypasses RLS for internal operations.
 */
export function createSupabaseClients(authHeader: string): {
  supabase: SupabaseClient;
  supabaseAdmin: SupabaseClient;
} {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  return { supabase, supabaseAdmin };
}

// ═══ Authentication ═══

/**
 * Authenticate a request and return user info + Supabase clients.
 * Returns a Response object on failure (ready to return from handler).
 *
 * Options:
 * - requireWorkspace: if true, also fetches and validates workspace membership
 */
export async function authenticateRequest(
  req: Request,
  options: { requireWorkspace?: boolean } = {}
): Promise<AuthResponse> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return {
      user: null,
      supabase: null,
      supabaseAdmin: null,
      workspaceId: null,
      error: errorResponse(req, 'Missing Authorization header', 401),
    };
  }

  const { supabase, supabaseAdmin } = createSupabaseClients(authHeader);

  // Validate JWT and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      user: null,
      supabase: null,
      supabaseAdmin: null,
      workspaceId: null,
      error: errorResponse(req, 'Invalid or expired token', 401),
    };
  }

  // Optionally fetch workspace
  let workspaceId: string | null = null;

  if (options.requireWorkspace) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.workspace_id) {
      return {
        user: null,
        supabase: null,
        supabaseAdmin: null,
        workspaceId: null,
        error: errorResponse(req, 'No workspace found for user', 403),
      };
    }

    workspaceId = membership.workspace_id;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    supabase,
    supabaseAdmin,
    workspaceId,
    error: null,
  };
}

/**
 * Quick auth check — returns user ID or null.
 * Use when you just need to know if the request is authenticated
 * without full workspace resolution.
 */
export async function getAuthUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Validate an API key from x-api-key header.
 * Checks against workspace_secrets table.
 * Used for external API access (widget, WhatsApp, etc.)
 */
export async function validateApiKey(
  req: Request
): Promise<{ valid: boolean; workspaceId: string | null; agentId: string | null }> {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) return { valid: false, workspaceId: null, agentId: null };

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data } = await supabaseAdmin
    .from('deploy_connections')
    .select('workspace_id, agent_id')
    .eq('api_key_hash', await hashApiKey(apiKey))
    .eq('status', 'active')
    .maybeSingle();

  if (!data) return { valid: false, workspaceId: null, agentId: null };

  return {
    valid: true,
    workspaceId: data.workspace_id,
    agentId: data.agent_id,
  };
}

// ═══ Helpers ═══

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
