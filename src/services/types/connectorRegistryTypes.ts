/**
 * Connector Registry — Type Definitions
 */

export type ConnectorCategory =
  | 'crm'
  | 'communication'
  | 'payment'
  | 'storage'
  | 'database'
  | 'ai_ml'
  | 'productivity'
  | 'marketing'
  | 'logistics'
  | 'analytics'
  | 'social'
  | 'custom';

export type ConnectorStatus = 'available' | 'connected' | 'error' | 'deprecated' | 'beta';
export type ConnectorAuthType = 'none' | 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'custom';

export interface ConnectorOperation {
  id: string;
  name: string;
  description: string;
  type: 'trigger' | 'action' | 'search';
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
}

export interface ConnectorDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  category: ConnectorCategory;
  auth_type: ConnectorAuthType;
  auth_config_schema: Record<string, unknown>;
  base_url: string;
  api_version: string;
  operations: ConnectorOperation[];
  rate_limit_per_minute: number;
  supports_webhooks: boolean;
  supports_polling: boolean;
  health_check_endpoint: string | null;
  documentation_url: string;
  status: ConnectorStatus;
  version: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ConnectorInstance {
  id: string;
  connector_id: string;
  name: string;
  credential_id: string | null;
  config: Record<string, unknown>;
  status: ConnectorStatus;
  last_health_check: string | null;
  health_check_result: Record<string, unknown> | null;
  usage_count: number;
  last_used_at: string | null;
  error_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectorHealth {
  connector_id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  response_time_ms: number | null;
  last_check: string;
  error: string | null;
  uptime_pct: number;
}
