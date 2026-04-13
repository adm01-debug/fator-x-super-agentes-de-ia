/**
 * Credential Vault — Type Definitions
 */

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
