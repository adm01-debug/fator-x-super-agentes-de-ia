/**
 * Nexus Agents Studio — Credential Vault Service
 */

import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';

export type {
  CredentialType, CredentialStatus, CredentialEntry, CredentialData,
  CreateCredentialInput, CredentialAuditLog, VaultStats,
} from './types/credentialVaultTypes';

import type {
  CredentialType, CredentialStatus, CredentialEntry, CredentialData,
  CreateCredentialInput, CredentialAuditLog, VaultStats,
} from './types/credentialVaultTypes';

/* ── Encryption (AES-256-GCM via Web Crypto API) ── */

const VAULT_KEY_NAME = 'nexus-vault-master-key-v1';

async function getOrCreateMasterKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const seed = encoder.encode(VAULT_KEY_NAME + '-promo-brindes-2026');
  const keyMaterial = await crypto.subtle.importKey('raw', seed, { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode('nexus-vault-salt-v1'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function encryptData(data: CredentialData): Promise<string> {
  const key = await getOrCreateMasterKey();
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(encrypted: string): Promise<CredentialData> {
  const key = await getOrCreateMasterKey();
  const combined = new Uint8Array(atob(encrypted).split('').map((c) => c.charCodeAt(0)));
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

/* ── Audit Logging ── */

async function logAudit(credentialId: string, action: CredentialAuditLog['action'], actorId: string | null, actorType: CredentialAuditLog['actor_type'], details: Record<string, unknown>): Promise<void> {
  await fromTable('credential_audit_logs').insert({ credential_id: credentialId, action, actor_id: actorId, actor_type: actorType, details });
}

/* ── CRUD Operations ── */

export async function createCredential(input: CreateCredentialInput): Promise<CredentialEntry> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;
  const encrypted = await encryptData(input.data);
  let nextRotation: string | null = null;
  if (input.rotation_interval_days) { const d = new Date(); d.setDate(d.getDate() + input.rotation_interval_days); nextRotation = d.toISOString(); }
  const { data, error } = await fromTable('credential_vault').insert({
    name: input.name, description: input.description ?? '', credential_type: input.credential_type,
    service_name: input.service_name, encrypted_data: encrypted, status: 'active' as CredentialStatus,
    expires_at: input.expires_at ?? null, rotation_interval_days: input.rotation_interval_days ?? null,
    last_rotated_at: null, next_rotation_at: nextRotation, allowed_agents: input.allowed_agents ?? [],
    allowed_workflows: input.allowed_workflows ?? [], access_count: 0, tags: input.tags ?? [], created_by: userId,
  }).select().single();
  if (error) throw error;
  await logAudit(data.id, 'created', userId, 'user', { credential_type: input.credential_type, service_name: input.service_name });
  return data as CredentialEntry;
}

export async function getCredential(id: string, requesterId?: string, requesterType: CredentialAuditLog['actor_type'] = 'user'): Promise<CredentialData> {
  const { data, error } = await fromTable('credential_vault').select('*').eq('id', id).single();
  if (error) throw error;
  const entry = data as CredentialEntry;
  if (requesterType === 'agent' && requesterId && entry.allowed_agents.length > 0 && !entry.allowed_agents.includes(requesterId)) throw new Error('Agent not authorized');
  if (requesterType === 'workflow' && requesterId && entry.allowed_workflows.length > 0 && !entry.allowed_workflows.includes(requesterId)) throw new Error('Workflow not authorized');
  if (entry.status === 'revoked') throw new Error('Credential has been revoked');
  if (entry.status === 'expired') throw new Error('Credential has expired');
  if (entry.expires_at && new Date(entry.expires_at) < new Date()) { await fromTable('credential_vault').update({ status: 'expired' }).eq('id', id); throw new Error('Credential has expired'); }
  await fromTable('credential_vault').update({ access_count: entry.access_count + 1, last_accessed_at: new Date().toISOString() }).eq('id', id);
  await logAudit(id, 'accessed', requesterId ?? null, requesterType, {});
  return decryptData(entry.encrypted_data);
}

export async function listCredentials(filters?: { credential_type?: CredentialType; service_name?: string; status?: CredentialStatus; tag?: string }): Promise<Omit<CredentialEntry, 'encrypted_data'>[]> {
  let query = fromTable('credential_vault').select('id, name, description, credential_type, service_name, status, expires_at, rotation_interval_days, last_rotated_at, next_rotation_at, allowed_agents, allowed_workflows, access_count, last_accessed_at, tags, created_by, created_at, updated_at').order('name', { ascending: true });
  if (filters?.credential_type) query = query.eq('credential_type', filters.credential_type);
  if (filters?.service_name) query = query.eq('service_name', filters.service_name);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.tag) query = query.contains('tags', [filters.tag]);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Omit<CredentialEntry, 'encrypted_data'>[];
}

export async function updateCredential(id: string, updates: { name?: string; description?: string; data?: CredentialData; expires_at?: string; rotation_interval_days?: number; allowed_agents?: string[]; allowed_workflows?: string[]; tags?: string[] }): Promise<CredentialEntry> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.expires_at !== undefined) patch.expires_at = updates.expires_at;
  if (updates.rotation_interval_days !== undefined) { patch.rotation_interval_days = updates.rotation_interval_days; const d = new Date(); d.setDate(d.getDate() + updates.rotation_interval_days); patch.next_rotation_at = d.toISOString(); }
  if (updates.allowed_agents !== undefined) patch.allowed_agents = updates.allowed_agents;
  if (updates.allowed_workflows !== undefined) patch.allowed_workflows = updates.allowed_workflows;
  if (updates.tags !== undefined) patch.tags = updates.tags;
  if (updates.data) patch.encrypted_data = await encryptData(updates.data);
  const { data, error } = await fromTable('credential_vault').update(patch).eq('id', id).select().single();
  if (error) throw error;
  await logAudit(id, 'updated', userId, 'user', { fields_updated: Object.keys(updates) });
  return data as CredentialEntry;
}

export async function rotateCredential(id: string, newData: CredentialData): Promise<CredentialEntry> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;
  const encrypted = await encryptData(newData);
  const now = new Date();
  const existing = await fromTable('credential_vault').select('rotation_interval_days').eq('id', id).single();
  if (existing.error) throw existing.error;
  let nextRotation: string | null = null;
  const interval = (existing.data as Record<string, unknown>).rotation_interval_days as number | null;
  if (interval) { const d = new Date(now); d.setDate(d.getDate() + interval); nextRotation = d.toISOString(); }
  const { data, error } = await fromTable('credential_vault').update({ encrypted_data: encrypted, status: 'active', last_rotated_at: now.toISOString(), next_rotation_at: nextRotation, updated_at: now.toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  await logAudit(id, 'rotated', userId, 'user', {});
  return data as CredentialEntry;
}

export async function revokeCredential(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await fromTable('credential_vault').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  await logAudit(id, 'revoked', userData?.user?.id ?? null, 'user', {});
}

export async function deleteCredential(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  await logAudit(id, 'deleted', userData?.user?.id ?? null, 'user', {});
  const { error } = await fromTable('credential_vault').delete().eq('id', id);
  if (error) throw error;
}

export async function getAuditLogs(credentialId: string, limit: number = 50): Promise<CredentialAuditLog[]> {
  const { data, error } = await fromTable('credential_audit_logs').select('*').eq('credential_id', credentialId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as CredentialAuditLog[];
}

export async function getVaultStats(): Promise<VaultStats> {
  const creds = await listCredentials();
  const now = new Date();
  const sevenDays = new Date(now); sevenDays.setDate(now.getDate() + 7);
  const byType = {} as Record<CredentialType, number>;
  let totalAccess = 0, expiringSoon = 0, rotationDue = 0;
  for (const c of creds) {
    byType[c.credential_type] = (byType[c.credential_type] ?? 0) + 1;
    totalAccess += c.access_count;
    if (c.expires_at && new Date(c.expires_at) <= sevenDays && c.status === 'active') expiringSoon++;
    if (c.next_rotation_at && new Date(c.next_rotation_at) <= now) rotationDue++;
  }
  return { total_credentials: creds.length, active: creds.filter((c) => c.status === 'active').length, expired: creds.filter((c) => c.status === 'expired').length, expiring_soon: expiringSoon, rotation_due: rotationDue, by_type: byType, total_access_count: totalAccess };
}

export { CREDENTIAL_TEMPLATES } from './presets/credentialPresets';
