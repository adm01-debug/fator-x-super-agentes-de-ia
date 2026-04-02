/**
 * Helper for tables added by migrations but not yet in generated types.
 * After running `supabase gen types typescript`, these can be removed.
 */
import { supabase } from '@/integrations/supabase/client';

type AnyTable = ReturnType<typeof supabase.from>;

export function fromTable(name: string): AnyTable {
  return (supabase as any).from(name);
}
