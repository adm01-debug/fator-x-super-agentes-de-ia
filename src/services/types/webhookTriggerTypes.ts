/**
 * Types for Webhook Trigger Service
 */

export type WebhookMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type WebhookStatus = 'active' | 'inactive' | 'rate_limited' | 'revoked';
export type WebhookAuthType = 'none' | 'header' | 'hmac_sha256' | 'basic' | 'bearer' | 'api_key';

export interface WebhookEndpoint {
  id: string;
  name: string;
  description: string;
  path: string;
  secret: string;
  methods: WebhookMethod[];
  auth_type: WebhookAuthType;
  auth_config: Record<string, unknown>;
  status: WebhookStatus;
  target_type: 'workflow' | 'agent' | 'edge_function' | 'custom';
  target_id: string;
  target_config: Record<string, unknown>;
  transform_script: string | null;
  rate_limit_per_minute: number;
  request_count: number;
  last_triggered_at: string | null;
  ip_whitelist: string[];
  headers_filter: Record<string, string>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  webhook_id: string;
  method: WebhookMethod;
  headers: Record<string, string>;
  query_params: Record<string, string>;
  body: Record<string, unknown> | null;
  source_ip: string | null;
  status: 'received' | 'processed' | 'failed' | 'rejected';
  response_code: number;
  response_body: Record<string, unknown> | null;
  processing_time_ms: number | null;
  error: string | null;
  created_at: string;
}

export interface CreateWebhookInput {
  name: string;
  description?: string;
  methods?: WebhookMethod[];
  auth_type?: WebhookAuthType;
  auth_config?: Record<string, unknown>;
  target_type: WebhookEndpoint['target_type'];
  target_id: string;
  target_config?: Record<string, unknown>;
  transform_script?: string;
  rate_limit_per_minute?: number;
  ip_whitelist?: string[];
  headers_filter?: Record<string, string>;
}

export interface WebhookTestResult {
  success: boolean;
  status_code: number;
  response_time_ms: number;
  payload_valid: boolean;
  auth_valid: boolean;
  transform_result: Record<string, unknown> | null;
  errors: string[];
}
