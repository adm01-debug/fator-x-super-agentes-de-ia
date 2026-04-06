-- ═══════════════════════════════════════════════════════════
-- Nexus Agents Studio — Seed Automation Data
-- Run in Supabase SQL Editor after migrations are applied
-- ═══════════════════════════════════════════════════════════

-- 1. CONNECTOR REGISTRY: Built-in connectors
INSERT INTO connector_registry (name, slug, description, icon, color, category, auth_type, base_url, api_version, operations, supports_webhooks, health_check_endpoint, status, version, tags)
VALUES
  ('Bitrix24', 'bitrix24', 'CRM completo para vendas e gestao', '🏢', '#00AEEF', 'crm', 'oauth2', 'https://{domain}.bitrix24.com.br/rest', 'v1', '[{"id":"deal-list","name":"Listar Deals","type":"action"},{"id":"contact-list","name":"Listar Contatos","type":"action"},{"id":"company-list","name":"Listar Empresas","type":"action"}]'::jsonb, true, '/server.time', 'available', '1.0.0', '["crm","vendas","bitrix"]'),
  ('WhatsApp (Evolution)', 'whatsapp', 'Mensagens via Evolution API', '💬', '#25D366', 'communication', 'api_key', '{server_url}', 'v2', '[{"id":"send-text","name":"Enviar Texto","type":"action"},{"id":"send-media","name":"Enviar Midia","type":"action"}]'::jsonb, true, '/instance/connectionState', 'available', '2.0.0', '["whatsapp","mensagens"]'),
  ('Supabase', 'supabase', 'Database, Auth, Storage e Edge Functions', '⚡', '#3ECF8E', 'database', 'api_key', '{project_url}', 'v1', '[{"id":"query","name":"Query Table","type":"action"},{"id":"insert","name":"Insert Row","type":"action"},{"id":"rpc","name":"Call RPC","type":"action"}]'::jsonb, true, '/rest/v1/', 'connected', '1.0.0', '["database","supabase"]'),
  ('OpenRouter', 'openrouter', 'Gateway para 100+ LLMs', '🤖', '#6366F1', 'ai_ml', 'bearer', 'https://openrouter.ai/api', 'v1', '[{"id":"chat","name":"Chat Completion","type":"action"},{"id":"models","name":"List Models","type":"action"}]'::jsonb, false, NULL, 'available', '1.0.0', '["llm","ai"]'),
  ('Email SMTP', 'email', 'Envio de emails transacionais', '📧', '#EA4335', 'communication', 'basic', 'smtp://{host}:{port}', 'smtp', '[{"id":"send","name":"Enviar Email","type":"action"}]'::jsonb, false, NULL, 'available', '1.0.0', '["email","smtp"]'),
  ('Slack', 'slack', 'Comunicacao do time via Slack', '💬', '#4A154B', 'communication', 'bearer', 'https://slack.com/api', 'v1', '[{"id":"send-message","name":"Enviar Mensagem","type":"action"},{"id":"upload-file","name":"Upload Arquivo","type":"action"}]'::jsonb, true, '/auth.test', 'available', '1.0.0', '["slack","comunicacao"]'),
  ('Google Sheets', 'google-sheets', 'Leitura e escrita em planilhas', '📊', '#0F9D58', 'productivity', 'oauth2', 'https://sheets.googleapis.com/v4', 'v4', '[{"id":"read-range","name":"Ler Range","type":"action"},{"id":"append","name":"Adicionar Linha","type":"action"}]'::jsonb, false, NULL, 'available', '1.0.0', '["google","planilhas"]')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  operations = EXCLUDED.operations,
  version = EXCLUDED.version;

-- 2. AUTOMATION TEMPLATES: Promo Brindes presets
INSERT INTO automation_templates (name, slug, description, category, icon, color, trigger_type, steps, estimated_time_saved, difficulty, tags, is_featured)
VALUES
  ('Lead para Orcamento Automatico', 'lead-to-quote', 'WhatsApp recebe lead -> AI classifica -> Gera orcamento no Bitrix24 -> Envia PDF por WhatsApp', 'vendas', '💰', '#FF6B6B', 'webhook', '[{"name":"Receber Lead","type":"webhook_trigger","config":{"source":"whatsapp"}},{"name":"Classificar Intencao","type":"llm","config":{"model":"gpt-4o-mini"}},{"name":"Gerar Orcamento","type":"api_connector","config":{"connector":"bitrix24"}},{"name":"Enviar WhatsApp","type":"send_notification","config":{"channel":"whatsapp"}}]'::jsonb, '2h/dia', 'intermediate', '["vendas","whatsapp","bitrix24"]', true),
  ('Pedido Aprovado para Compras', 'order-to-purchase', 'Pedido aprovado no Bitrix24 -> Verifica estoque -> Gera ordem de compra -> Notifica fornecedor', 'compras', '📦', '#4ECDC4', 'webhook', '[{"name":"Pedido Aprovado","type":"webhook_trigger","config":{"source":"bitrix24"}},{"name":"Verificar Estoque","type":"api_connector","config":{"connector":"supabase"}},{"name":"Gerar OC","type":"llm","config":{}},{"name":"Notificar Fornecedor","type":"send_notification","config":{"channel":"email"}}]'::jsonb, '3h/dia', 'intermediate', '["compras","bitrix24"]', true),
  ('Tracking para Notificacao Cliente', 'tracking-notify', 'Webhook de rastreio -> Extrai status -> Atualiza Bitrix24 -> Notifica cliente por WhatsApp', 'logistica', '🚚', '#96CEB4', 'webhook', '[{"name":"Webhook Rastreio","type":"webhook_trigger","config":{}},{"name":"Extrair Status","type":"llm","config":{}},{"name":"Atualizar CRM","type":"api_connector","config":{"connector":"bitrix24"}},{"name":"Notificar Cliente","type":"send_notification","config":{"channel":"whatsapp"}}]'::jsonb, '1h/dia', 'beginner', '["logistica","whatsapp"]', true),
  ('Briefing de Arte para Aprovacao', 'art-brief-approval', 'Formulario de briefing -> AI gera proposta -> Envia para aprovacao -> Notifica equipe', 'design', '🎨', '#DDA0DD', 'webhook', '[{"name":"Receber Briefing","type":"webhook_trigger","config":{}},{"name":"Gerar Proposta","type":"llm","config":{}},{"name":"Enviar Aprovacao","type":"api_connector","config":{"connector":"bitrix24"}},{"name":"Notificar Equipe","type":"send_notification","config":{"channel":"slack"}}]'::jsonb, '45min/briefing', 'intermediate', '["design","aprovacao"]', false),
  ('Fechamento Financeiro Diario', 'daily-financial-close', 'Cron 18h -> Agrega dados financeiros -> Gera relatorio -> Envia por email e Slack', 'financeiro', '💵', '#45B7D1', 'cron', '[{"name":"Cron 18h","type":"cron_trigger","config":{"expression":"0 18 * * 1-5"}},{"name":"Agregar Dados","type":"api_connector","config":{"connector":"supabase"}},{"name":"Gerar Relatorio","type":"llm","config":{}},{"name":"Enviar Email","type":"send_notification","config":{"channel":"email"}},{"name":"Enviar Slack","type":"send_notification","config":{"channel":"slack"}}]'::jsonb, '1h/dia', 'advanced', '["financeiro","relatorio"]', true),
  ('Monitoramento de Saude dos Agentes', 'agent-health-monitor', 'Cron cada 5min -> Verifica metricas -> Alerta se anomalia -> Notifica equipe', 'operacional', '🏥', '#FF8C42', 'cron', '[{"name":"Cron 5min","type":"cron_trigger","config":{"expression":"*/5 * * * *"}},{"name":"Verificar Metricas","type":"api_connector","config":{"connector":"supabase"}},{"name":"Detectar Anomalias","type":"llm","config":{}},{"name":"Alertar Equipe","type":"send_notification","config":{"channel":"slack"}}]'::jsonb, 'preventivo', 'beginner', '["monitoramento","alertas"]', false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  steps = EXCLUDED.steps,
  is_featured = EXCLUDED.is_featured;

-- 3. NOTIFICATION TEMPLATES
INSERT INTO notification_templates (name, slug, channel, subject_template, body_template, variables, is_system)
VALUES
  ('Alerta de Erro', 'error-alert', 'email', 'Alerta: {{agent_name}} - Erro {{error_type}}', 'O agente "{{agent_name}}" encontrou um erro {{error_type}} as {{timestamp}}.\n\nDetalhes: {{error_message}}\n\nAcao recomendada: {{recommendation}}', '["agent_name","error_type","timestamp","error_message","recommendation"]'::jsonb, true),
  ('Novo Lead WhatsApp', 'new-lead-whatsapp', 'whatsapp', NULL, 'Ola {{contact_name}}! Recebemos sua solicitacao de orcamento para {{product_name}}. Nosso time ja esta trabalhando e voce recebera o orcamento em ate {{sla_hours}}h. Qualquer duvida, estamos aqui!', '["contact_name","product_name","sla_hours"]'::jsonb, true),
  ('Relatorio Diario', 'daily-report', 'email', 'Relatorio Diario - {{date}}', 'Resumo do dia {{date}}:\n\n- Agentes ativos: {{active_agents}}\n- Execucoes: {{executions}}\n- Custo total: R$ {{total_cost}}\n- Erros: {{error_count}}\n\nDetalhamento completo no dashboard.', '["date","active_agents","executions","total_cost","error_count"]'::jsonb, true),
  ('Aprovacao Pendente', 'pending-approval', 'slack', NULL, ':warning: *Aprovacao Pendente*\n\nWorkflow: {{workflow_name}}\nSolicitante: {{requester}}\nDetalhes: {{details}}\n\n<{{approval_url}}|Aprovar/Rejeitar>', '["workflow_name","requester","details","approval_url"]'::jsonb, true)
ON CONFLICT (slug) DO UPDATE SET
  body_template = EXCLUDED.body_template,
  variables = EXCLUDED.variables;

-- Verify seed data
SELECT 'connector_registry' as tbl, count(*) as cnt FROM connector_registry
UNION ALL SELECT 'automation_templates', count(*) FROM automation_templates
UNION ALL SELECT 'notification_templates', count(*) FROM notification_templates;
