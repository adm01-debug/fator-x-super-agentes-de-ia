/**
 * Nexus Agents Studio — Credential Vault Service
 *
 * Secure secrets management with encryption, rotation policies,
 * access control per agent/workflow, and full audit trail.
 *
 * Inspired by: n8n Credential Store + HashiCorp Vault integration,
 * Automation Anywhere Credential Vault, Windmill Secrets Management.
 *
 * Gap 4/10 — automation topic analysis
 */

import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type CredentialType =
  | 'api_key'
  | 'oauth2'
  | 'basic_auth'
  | 'bearer_token'
  | 'ssh_key'
  | 'database'
  | 'smtp'
  | 'webhook_secret'
  | 'custom';

export type CredentialStatus = 'active' | 'expired' | 'revoked' | 'rotating';

export interface CredentialEntry {
  id: string;
  name: string;
  description: string;
  credential_type: CredentialType;
  service_name: string;
  encrypted_data: string;
  status: CredentialStatus;
  expires_at: string | null;
  rotation_interval_days: number | null;
  last_rotated_at: string | null;
  next_rotation_at: string | null;
  allowed_agents: string[];
  allowed_workflows: string[];
  access_count: number;
  last_accessed_at: string | null;
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CredentialData {
  [key: string]: string | number | boolean | null;
}

export interface CreateCredentialInput {
  name: string;
  description?: string;
  credential_type: CredentialType;
  service_name: string;
  data: CredentialData;
  expires_at?: string;
  rotation_interval_days?: number;
  allowed_agents?: string[];
  allowed_workflows?: string[];
  tags?: string[];
}

export interface CredentialAuditLog {
  id: string;
  credential_id: string;
  action: 'created' | 'accessed' | 'updated' | 'rotated' | 'revoked' | 'deleted';
  actor_id: string | null;
  actor_type: 'user' | 'agent' | 'workflow' | 'system';
  ip_address: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface VaultStats {
  total_credentials: number;
  active: number;
  expired: number;
  expiring_soon: number;
  rotation_due: number;
  by_type: Record<CredentialType, number>;
  total_access_count: number;
}

/* ------------------------------------------------------------------ */
/*  Encryption (AES-256-GCM via Web Crypto API)                        */
/* ------------------------------------------------------------------ */

const VAULT_KEY_NAME = 'nexus-vault-master-key-v1';

async function getOrCreateMasterKey(workspaceId?: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const seed = encoder.encode(VAULT_KEY_NAME + '-promo-brindes-2026');

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    seed,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  // Use workspace-specific salt to isolate keys between workspaces
  const saltBase = workspaceId
    ? `nexus-vault-salt-ws-${workspaceId}`
    : 'nexus-vault-salt-v1';

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(saltBase),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptData(data: CredentialData): Promise<string> {
  const key = await getOrCreateMasterKey();
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  );

  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(encrypted: string): Promise<CredentialData> {
  const key = await getOrCreateMasterKey();
  const combined = new Uint8Array(
    atob(encrypted)
      .split('')
      .map((c) => c.charCodeAt(0)),
  );

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plaintext));
}

/* ------------------------------------------------------------------ */
/*  CRUD Operations                                                    */
/* ------------------------------------------------------------------ */

export async function createCredential(
  input: CreateCredentialInput,
): Promise<CredentialEntry> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  const encrypted = await encryptData(input.data);

  let nextRotation: string | null = null;
  if (input.rotation_interval_days) {
    const d = new Date();
    d.setDate(d.getDate() + input.rotation_interval_days);
    nextRotation = d.toISOString();
  }

  const record = {
    name: input.name,
    description: input.description ?? '',
    credential_type: input.credential_type,
    service_name: input.service_name,
    encrypted_data: encrypted,
    status: 'active' as CredentialStatus,
    expires_at: input.expires_at ?? null,
    rotation_interval_days: input.rotation_interval_days ?? null,
    last_rotated_at: null,
    next_rotation_at: nextRotation,
    allowed_agents: input.allowed_agents ?? [],
    allowed_workflows: input.allowed_workflows ?? [],
    access_count: 0,
    tags: input.tags ?? [],
    created_by: userId,
  };

  const { data, error } = await fromTable('credential_vault').insert(record).select().single();
  if (error) throw error;

  await logAudit(data.id, 'created', userId, 'user', {
    credential_type: input.credential_type,
    service_name: input.service_name,
  });

  return data as CredentialEntry;
}

export async function getCredential(
  id: string,
  requesterId?: string,
  requesterType: CredentialAuditLog['actor_type'] = 'user',
): Promise<CredentialData> {
  const { data, error } = await fromTable('credential_vault').select('*').eq('id', id).single();
  if (error) throw error;

  const entry = data as CredentialEntry;

  if (requesterType === 'agent' && requesterId) {
    if (entry.allowed_agents.length > 0 && !entry.allowed_agents.includes(requesterId)) {
      throw new Error('Agent not authorized to access this credential');
    }
  }
  if (requesterType === 'workflow' && requesterId) {
    if (entry.allowed_workflows.length > 0 && !entry.allowed_workflows.includes(requesterId)) {
      throw new Error('Workflow not authorized to access this credential');
    }
  }

  if (entry.status === 'revoked') {
    throw new Error('Credential has been revoked');
  }
  if (entry.status === 'expired') {
    throw new Error('Credential has expired');
  }
  if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
    await fromTable('credential_vault').update({ status: 'expired' }).eq('id', id);
    throw new Error('Credential has expired');
  }

  await fromTable('credential_vault').update({
    access_count: entry.access_count + 1,
    last_accessed_at: new Date().toISOString(),
  }).eq('id', id);

  await logAudit(id, 'accessed', requesterId ?? null, requesterType, {});

  return decryptData(entry.encrypted_data);
}

export async function listCredentials(
  filters?: {
    credential_type?: CredentialType;
    service_name?: string;
    status?: CredentialStatus;
    tag?: string;
  },
): Promise<Omit<CredentialEntry, 'encrypted_data'>[]> {
  let query = fromTable('credential_vault').select(
    'id, name, description, credential_type, service_name, status, ' +
    'expires_at, rotation_interval_days, last_rotated_at, next_rotation_at, ' +
    'allowed_agents, allowed_workflows, access_count, last_accessed_at, ' +
    'tags, created_by, created_at, updated_at',
  ).order('name', { ascending: true });

  if (filters?.credential_type) {
    query = query.eq('credential_type', filters.credential_type);
  }
  if (filters?.service_name) {
    query = query.eq('service_name', filters.service_name);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.tag) {
    query = query.contains('tags', [filters.tag]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Omit<CredentialEntry, 'encrypted_data'>[];
}

export async function updateCredential(
  id: string,
  updates: {
    name?: string;
    description?: string;
    data?: CredentialData;
    expires_at?: string;
    rotation_interval_days?: number;
    allowed_agents?: string[];
    allowed_workflows?: string[];
    tags?: string[];
  },
): Promise<CredentialEntry> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.expires_at !== undefined) patch.expires_at = updates.expires_at;
  if (updates.rotation_interval_days !== undefined) {
    patch.rotation_interval_days = updates.rotation_interval_days;
    const d = new Date();
    d.setDate(d.getDate() + updates.rotation_interval_days);
    patch.next_rotation_at = d.toISOString();
  }
  if (updates.allowed_agents !== undefined) patch.allowed_agents = updates.allowed_agents;
  if (updates.allowed_workflows !== undefined) patch.allowed_workflows = updates.allowed_workflows;
  if (updates.tags !== undefined) patch.tags = updates.tags;
  if (updates.data) {
    patch.encrypted_data = await encryptData(updates.data);
  }

  const { data, error } = await fromTable('credential_vault').update(patch).eq('id', id).select().single();
  if (error) throw error;

  await logAudit(id, 'updated', userId, 'user', { fields_updated: Object.keys(updates) });

  return data as CredentialEntry;
}

export async function rotateCredential(
  id: string,
  newData: CredentialData,
): Promise<CredentialEntry> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  const encrypted = await encryptData(newData);
  const now = new Date();

  const existing = await fromTable('credential_vault').select('rotation_interval_days').eq('id', id).single();
  if (existing.error) throw existing.error;

  let nextRotation: string | null = null;
  const interval = (existing.data as Record<string, unknown>).rotation_interval_days as number | null;
  if (interval) {
    const d = new Date(now);
    d.setDate(d.getDate() + interval);
    nextRotation = d.toISOString();
  }

  const { data, error } = await fromTable('credential_vault').update({
    encrypted_data: encrypted,
    status: 'active',
    last_rotated_at: now.toISOString(),
    next_rotation_at: nextRotation,
    updated_at: now.toISOString(),
  }).eq('id', id).select().single();
  if (error) throw error;

  await logAudit(id, 'rotated', userId, 'user', {});

  return data as CredentialEntry;
}

export async function revokeCredential(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  const { error } = await fromTable('credential_vault').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;

  await logAudit(id, 'revoked', userId, 'user', {});
}

export async function deleteCredential(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  await logAudit(id, 'deleted', userId, 'user', {});

  const { error } = await fromTable('credential_vault').delete().eq('id', id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Audit Logging                                                      */
/* ------------------------------------------------------------------ */

async function logAudit(
  credentialId: string,
  action: CredentialAuditLog['action'],
  actorId: string | null,
  actorType: CredentialAuditLog['actor_type'],
  details: Record<string, unknown>,
): Promise<void> {
  await fromTable('credential_audit_logs').insert({
    credential_id: credentialId,
    action,
    actor_id: actorId,
    actor_type: actorType,
    details,
  });
}

export async function getAuditLogs(
  credentialId: string,
  limit: number = 50,
): Promise<CredentialAuditLog[]> {
  const { data, error } = await fromTable('credential_audit_logs').select('*').eq('credential_id', credentialId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as CredentialAuditLog[];
}

/* ------------------------------------------------------------------ */
/*  Stats & Health                                                     */
/* ------------------------------------------------------------------ */

export async function getVaultStats(): Promise<VaultStats> {
  const creds = await listCredentials();
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(now.getDate() + 7);

  const byType = {} as Record<CredentialType, number>;
  let totalAccess = 0;
  let expiringSoon = 0;
  let rotationDue = 0;

  for (const c of creds) {
    byType[c.credential_type] = (byType[c.credential_type] ?? 0) + 1;
    totalAccess += c.access_count;

    if (c.expires_at && new Date(c.expires_at) <= sevenDaysFromNow && c.status === 'active') {
      expiringSoon++;
    }
    if (c.next_rotation_at && new Date(c.next_rotation_at) <= now) {
      rotationDue++;
    }
  }

  return {
    total_credentials: creds.length,
    active: creds.filter((c) => c.status === 'active').length,
    expired: creds.filter((c) => c.status === 'expired').length,
    expiring_soon: expiringSoon,
    rotation_due: rotationDue,
    by_type: byType,
    total_access_count: totalAccess,
  };
}

/* ------------------------------------------------------------------ */
/*  Credential Templates (Promo Brindes)                               */
/* ------------------------------------------------------------------ */

export const CREDENTIAL_TEMPLATES: Record<
  string,
  { label: string; type: CredentialType; fields: string[]; service: string }
> = {
  bitrix24: {
    label: 'Bitrix24 CRM',
    type: 'oauth2',
    fields: ['client_id', 'client_secret', 'access_token', 'refresh_token', 'domain'],
    service: 'bitrix24',
  },
  whatsapp_evolution: {
    label: 'WhatsApp (Evolution API)',
    type: 'api_key',
    fields: ['api_key', 'instance_name', 'server_url'],
    service: 'whatsapp',
  },
  supabase_project: {
    label: 'Supabase Project',
    type: 'api_key',
    fields: ['project_url', 'anon_key', 'service_role_key'],
    service: 'supabase',
  },
  openrouter: {
    label: 'OpenRouter (LLM Gateway)',
    type: 'api_key',
    fields: ['api_key'],
    service: 'openrouter',
  },
  anthropic: {
    label: 'Anthropic Claude',
    type: 'api_key',
    fields: ['api_key'],
    service: 'anthropic',
  },
  smtp_email: {
    label: 'SMTP Email',
    type: 'smtp',
    fields: ['host', 'port', 'username', 'password', 'from_email', 'from_name'],
    service: 'email',
  },
  stripe: {
    label: 'Stripe Pagamentos',
    type: 'api_key',
    fields: ['publishable_key', 'secret_key', 'webhook_secret'],
    service: 'stripe',
  },
  hostinger_vps: {
    label: 'Hostinger VPS',
    type: 'api_key',
    fields: ['api_token', 'vps_id', 'ssh_host', 'ssh_user'],
    service: 'hostinger',
  },
  slack: {
    label: 'Slack Bot',
    type: 'bearer_token',
    fields: ['bot_token', 'signing_secret', 'app_id'],
    service: 'slack',
  },
  google_sheets: {
    label: 'Google Sheets',
    type: 'oauth2',
    fields: ['client_id', 'client_secret', 'refresh_token'],
    service: 'google-sheets',
  },
};
