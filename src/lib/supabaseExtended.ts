/**
 * Helper for tables added by migrations but not yet in auto-generated types.
 * Uses type assertion scoped to this single file to keep the rest of the codebase clean.
 * Tables here: prompt_ab_tests, alert_rules
 */
import { supabase } from '@/integrations/supabase/client';

type SupabaseFrom = ReturnType<typeof supabase.from>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromTable(name: string): SupabaseFrom {
  return (supabase as unknown as { from: (n: string) => SupabaseFrom }).from(name);
}
