import { supabase } from "@/integrations/supabase/client";

export type SecretCategory =
  | 'api_key' | 'oauth_client' | 'db_password' | 'jwt_signing'
  | 'webhook_secret' | 'encryption_key' | 'ssh_key' | 'certificate';

export type SecretEnvironment = 'prod' | 'staging' | 'dev';
export type SecretStatus = 'active' | 'pending_rotation' | 'overdue' | 'retired';
export type RotationReason = 'scheduled' | 'compromised' | 'employee_offboarding' | 'manual' | 'policy_change';

export interface ManagedSecret {
  id: string;
  workspace_id: string;
  name: string;
  category: SecretCategory;
  provider: string | null;
  environment: SecretEnvironment;
  rotation_interval_days: number;
  last_rotated_at: string | null;
  next_rotation_due: string | null;
  status: SecretStatus;
  owner_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface SecretRotationEvent {
  id: string;
  secret_id: string;
  rotated_by: string;
  rotated_at: string;
  reason: RotationReason;
  previous_age_days: number | null;
  notes: string | null;
  created_at: string;
}

export interface SecretsSummary {
  total: number;
  active: number;
  pending: number;
  overdue: number;
  retired: number;
  by_category: Record<string, number>;
}

export interface RegisterSecretInput {
  workspace_id: string;
  name: string;
  category: SecretCategory;
  provider?: string;
  environment?: SecretEnvironment;
  rotation_interval_days?: number;
  owner_id?: string;
  notes?: string;
  last_rotated_at?: string;
}

export async function listManagedSecrets(workspaceId: string): Promise<ManagedSecret[]> {
  const { data, error } = await supabase
    .from('managed_secrets')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('next_rotation_due', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as ManagedSecret[];
}

export async function getSecretsSummary(workspaceId: string): Promise<SecretsSummary> {
  const { data, error } = await supabase.rpc('get_secrets_status_summary', { p_workspace_id: workspaceId });
  if (error) throw error;
  return data as unknown as SecretsSummary;
}

export async function registerManagedSecret(input: RegisterSecretInput): Promise<string> {
  const { data, error } = await supabase.rpc('register_managed_secret', {
    p_workspace_id: input.workspace_id,
    p_name: input.name,
    p_category: input.category,
    p_provider: input.provider ?? undefined,
    p_environment: input.environment ?? 'prod',
    p_rotation_interval_days: input.rotation_interval_days ?? 90,
    p_owner_id: input.owner_id ?? undefined,
    p_notes: input.notes ?? undefined,
    p_last_rotated_at: input.last_rotated_at ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function recordSecretRotation(secretId: string, reason: RotationReason, notes?: string): Promise<string> {
  const { data, error } = await supabase.rpc('record_secret_rotation', {
    p_secret_id: secretId,
    p_reason: reason,
    p_notes: notes ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function markSecretRetired(secretId: string, notes?: string): Promise<void> {
  const { error } = await supabase.rpc('mark_secret_retired', {
    p_secret_id: secretId,
    p_notes: notes ?? undefined,
  });
  if (error) throw error;
}

export async function listRotationEvents(secretId: string): Promise<SecretRotationEvent[]> {
  const { data, error } = await supabase
    .from('secret_rotation_events')
    .select('*')
    .eq('secret_id', secretId)
    .order('rotated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SecretRotationEvent[];
}

export async function refreshSecretsStatus(): Promise<{ marked_overdue: number; marked_pending: number }> {
  const { data, error } = await supabase.rpc('refresh_secrets_status');
  if (error) throw error;
  return data as unknown as { marked_overdue: number; marked_pending: number };
}

export const SECRET_CATEGORY_LABELS: Record<SecretCategory, string> = {
  api_key: 'API Key',
  oauth_client: 'OAuth Client',
  db_password: 'Senha de DB',
  jwt_signing: 'JWT Signing',
  webhook_secret: 'Webhook Secret',
  encryption_key: 'Chave de Criptografia',
  ssh_key: 'Chave SSH',
  certificate: 'Certificado',
};

export const ROTATION_REASON_LABELS: Record<RotationReason, string> = {
  scheduled: 'Agendada',
  compromised: 'Comprometida',
  employee_offboarding: 'Offboarding',
  manual: 'Manual',
  policy_change: 'Mudança de Política',
};

export const SECRET_TEMPLATES: Array<{ name: string; category: SecretCategory; rotation_interval_days: number; provider?: string }> = [
  { name: 'OpenAI API Key', category: 'api_key', rotation_interval_days: 90, provider: 'OpenAI' },
  { name: 'Anthropic API Key', category: 'api_key', rotation_interval_days: 90, provider: 'Anthropic' },
  { name: 'Database Password (prod)', category: 'db_password', rotation_interval_days: 180 },
  { name: 'JWT Signing Key', category: 'jwt_signing', rotation_interval_days: 30 },
  { name: 'OAuth Client Secret', category: 'oauth_client', rotation_interval_days: 365 },
  { name: 'Webhook Signing Secret', category: 'webhook_secret', rotation_interval_days: 90 },
];

export function getDaysUntilRotation(nextDue: string | null): number | null {
  if (!nextDue) return null;
  const ms = new Date(nextDue).getTime() - Date.now();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function getStatusVariant(status: SecretStatus, daysUntil: number | null): 'overdue' | 'urgent' | 'soon' | 'ok' | 'retired' {
  if (status === 'retired') return 'retired';
  if (status === 'overdue' || (daysUntil !== null && daysUntil < 0)) return 'overdue';
  if (daysUntil !== null && daysUntil < 7) return 'urgent';
  if (daysUntil !== null && daysUntil < 30) return 'soon';
  return 'ok';
}
