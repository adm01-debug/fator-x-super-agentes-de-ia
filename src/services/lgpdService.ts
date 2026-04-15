/**
 * Nexus Agents Studio — LGPD Compliance Service
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';

export async function listConsentRecords() {
  const { data } = await supabaseExternal.from('consent_records').select('*').order('created_at', { ascending: false });
  return data ?? [];
}

export async function listDeletionRequests() {
  const { data } = await supabaseExternal.from('data_deletion_requests').select('*').order('requested_at', { ascending: false });
  return data ?? [];
}

export async function exportMyData() {
  const { data, error } = await supabase.functions.invoke('lgpd-manager', {
    body: { action: 'get_my_data' },
  });
  if (error) throw error;
  return data;
}

export async function requestDeletion(scope: string) {
  const { data, error } = await supabase.functions.invoke('lgpd-manager', {
    body: { action: 'request_deletion', scope },
  });
  if (error) throw error;
  return data;
}

export async function manageConsent(purpose: string, grant: boolean) {
  await supabase.functions.invoke('lgpd-manager', {
    body: { action: grant ? 'consent_grant' : 'consent_revoke', purpose, legal_basis: 'consent' },
  });
}
