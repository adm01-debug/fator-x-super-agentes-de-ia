/**
 * User filter preferences — persists per-user, per-scope filter state in Cloud.
 * Falls back gracefully (caller manages localStorage fallback).
 */
import { fromTable } from '@/lib/supabaseExtended';
import { supabase } from '@/integrations/supabase/client';

export type FilterScope = 'agent_traces';

export async function getUserFilters<T = Record<string, unknown>>(
  scope: FilterScope,
): Promise<T | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;
  try {
    const { data, error } = await fromTable('user_filter_preferences')
      .select('filters')
      .eq('user_id', userId)
      .eq('scope', scope)
      .maybeSingle();
    if (error) throw error;
    return (data?.filters ?? null) as T | null;
  } catch (e) {
    console.warn('[userFilterPreferences] read failed', e);
    return null;
  }
}

export async function saveUserFilters<T = Record<string, unknown>>(
  scope: FilterScope,
  filters: T,
): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return false;
  try {
    const { error } = await fromTable('user_filter_preferences')
      .upsert(
        { user_id: userId, scope, filters, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,scope' },
      );
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[userFilterPreferences] save failed', e);
    return false;
  }
}

export async function deleteUserFilters(scope: FilterScope): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return false;
  try {
    const { error } = await fromTable('user_filter_preferences')
      .delete()
      .eq('user_id', userId)
      .eq('scope', scope);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[userFilterPreferences] delete failed', e);
    return false;
  }
}
