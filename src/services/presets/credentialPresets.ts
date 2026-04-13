import type { CredentialType } from '../types/credentialVaultTypes';

export const CREDENTIAL_TEMPLATES: Record<string, { label: string; type: CredentialType; fields: string[]; service: string }> = {
  bitrix24: { label: 'Bitrix24 CRM', type: 'oauth2', fields: ['client_id', 'client_secret', 'access_token', 'refresh_token', 'domain'], service: 'bitrix24' },
  whatsapp_evolution: { label: 'WhatsApp (Evolution API)', type: 'api_key', fields: ['api_key', 'instance_name', 'server_url'], service: 'whatsapp' },
  supabase_project: { label: 'Supabase Project', type: 'api_key', fields: ['project_url', 'anon_key', 'service_role_key'], service: 'supabase' },
  openrouter: { label: 'OpenRouter (LLM Gateway)', type: 'api_key', fields: ['api_key'], service: 'openrouter' },
  anthropic: { label: 'Anthropic Claude', type: 'api_key', fields: ['api_key'], service: 'anthropic' },
  smtp_email: { label: 'SMTP Email', type: 'smtp', fields: ['host', 'port', 'username', 'password', 'from_email', 'from_name'], service: 'email' },
  stripe: { label: 'Stripe Pagamentos', type: 'api_key', fields: ['publishable_key', 'secret_key', 'webhook_secret'], service: 'stripe' },
  hostinger_vps: { label: 'Hostinger VPS', type: 'api_key', fields: ['api_token', 'vps_id', 'ssh_host', 'ssh_user'], service: 'hostinger' },
  slack: { label: 'Slack Bot', type: 'bearer_token', fields: ['bot_token', 'signing_secret', 'app_id'], service: 'slack' },
  google_sheets: { label: 'Google Sheets', type: 'oauth2', fields: ['client_id', 'client_secret', 'refresh_token'], service: 'google-sheets' },
};
