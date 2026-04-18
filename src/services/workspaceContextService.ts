/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Workspace Context Service
 * ═══════════════════════════════════════════════════════════════
 * Centralizes the recurring "fetch workspace id / admin flag" pattern
 * that was previously duplicated across 7 P3 pages calling
 * supabase.from('workspaces') directly.
 *
 * Single source of truth for workspace resolution from the Supabase
 * auth client. All errors are wrapped with structured logging.
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

function wrapErr(op: string, error: unknown, ctx?: Record<string, unknown>): never {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`workspaceContextService.${op} failed`, { error: message, ...ctx });
  throw error instanceof Error ? error : new Error(message);
}

/** Resolve the workspace id owned by the given user (or null). */
export async function getWorkspaceIdForUser(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  } catch (e) {
    wrapErr('getWorkspaceIdForUser', e, { userId });
  }
}

/** Resolve the first available workspace id (used by pages without per-user scoping). */
export async function getFirstWorkspaceId(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  } catch (e) {
    wrapErr('getFirstWorkspaceId', e);
  }
}

/** Return whether the given user is the owner (admin) of the given workspace. */
export async function isWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .maybeSingle();
    if (error) throw error;
    return data?.owner_id === userId;
  } catch (e) {
    wrapErr('isWorkspaceOwner', e, { workspaceId, userId });
  }
}

/** Resolve full workspace summary (id + name) for the current authenticated user. */
export async function getCurrentUserWorkspace(): Promise<{ id: string; name: string } | null> {
  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user) return null;
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  } catch (e) {
    wrapErr('getCurrentUserWorkspace', e);
  }
}
