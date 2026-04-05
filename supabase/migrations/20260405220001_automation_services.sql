-- ============================================================
-- Nexus Agents Studio — Automation Services Migration
-- 17 tables for: Cron, Webhooks, Retry/DLQ, Credentials,
-- Notifications, Templates, Execution History, Connectors,
-- Queues, Batch Jobs
-- ============================================================

-- 1. CRON SCHEDULES
CREATE TABLE IF NOT EXISTS public.cron_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  frequency TEXT NOT NULL CHECK (frequency IN ('once','interval','cron','daily','weekly','monthly')),
  cron_expression TEXT,
  interval_seconds INTEGER,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  max_runs INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','completed','failed','expired')),
  target_type TEXT NOT NULL CHECK (target_type IN ('workflow','agent','edge_function','webhook')),
  target_id TEXT NOT NULL,
  target_config JSONB DEFAULT '{}',
  retry_on_failure BOOLEAN DEFAULT true,
  max_retries INTEGER DEFAULT 3,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_schedules_status ON public.cron_schedules(status);
CREATE INDEX IF NOT EXISTS idx_cron_schedules_next_run ON public.cron_schedules(next_run_at) WHERE status = 'active';

ALTER TABLE public.cron_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cron_schedules_all" ON public.cron_schedules FOR ALL USING (auth.uid() IS NOT NULL);

-- 2. CRON SCHEDULE EXECUTIONS
CREATE TABLE IF NOT EXISTS public.cron_schedule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.cron_schedules(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN ('running','success','failed','skipped')),
  result JSONB,
  error TEXT,
  duration_ms INTEGER,
  attempt INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_exec_schedule ON public.cron_schedule_executions(schedule_id, started_at DESC);

ALTER TABLE public.cron_schedule_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cron_exec_all" ON public.cron_schedule_executions FOR ALL USING (auth.uid() IS NOT NULL);

-- 3. WEBHOOK ENDPOINTS
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  path TEXT NOT NULL UNIQUE,
  secret TEXT NOT NULL,
  methods TEXT[] DEFAULT ARRAY['POST'],
  auth_type TEXT DEFAULT 'hmac_sha256' CHECK (auth_type IN ('none','header','hmac_sha256','basic','bearer','api_key')),
  auth_config JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','rate_limited','revoked')),
  target_type TEXT NOT NULL CHECK (target_type IN ('workflow','agent','edge_function','custom')),
  target_id TEXT NOT NULL,
  target_config JSONB DEFAULT '{}',
  transform_script TEXT,
  rate_limit_per_minute INTEGER DEFAULT 60,
  request_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  ip_whitelist TEXT[] DEFAULT ARRAY[]::TEXT[],
  headers_filter JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_path ON public.webhook_endpoints(path);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON public.webhook_endpoints(status);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks_all" ON public.webhook_endpoints FOR ALL USING (auth.uid() IS NOT NULL);

-- Helper function for webhook counter
CREATE OR REPLACE FUNCTION public.increment_webhook_counter(webhook_uuid UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.webhook_endpoints 
  SET request_count = request_count + 1, last_triggered_at = now()
  WHERE id = webhook_uuid;
END;
$$;

-- 4. WEBHOOK EVENTS
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  headers JSONB DEFAULT '{}',
  query_params JSONB DEFAULT '{}',
  body JSONB,
  source_ip TEXT,
  status TEXT DEFAULT 'received' CHECK (status IN ('received','processed','failed','rejected')),
  response_code INTEGER DEFAULT 200,
  response_body JSONB,
  processing_time_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook ON public.webhook_events(webhook_id, created_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_events_all" ON public.webhook_events FOR ALL USING (auth.uid() IS NOT NULL);

-- 5. DEAD LETTER QUEUE
CREATE TABLE IF NOT EXISTS public.dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  error TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  retry_policy JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','retried','resolved','discarded')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dlq_status ON public.dead_letter_queue(status);

ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dlq_all" ON public.dead_letter_queue FOR ALL USING (auth.uid() IS NOT NULL);

-- 6. CREDENTIAL VAULT
CREATE TABLE IF NOT EXISTS public.credential_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  credential_type TEXT NOT NULL CHECK (credential_type IN ('api_key','oauth2','basic_auth','bearer_token','ssh_key','database','smtp','webhook_secret','custom')),
  service_name TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','expired','revoked','rotating')),
  expires_at TIMESTAMPTZ,
  rotation_interval_days INTEGER,
  last_rotated_at TIMESTAMPTZ,
  next_rotation_at TIMESTAMPTZ,
  allowed_agents TEXT[] DEFAULT ARRAY[]::TEXT[],
  allowed_workflows TEXT[] DEFAULT ARRAY[]::TEXT[],
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cred_vault_type ON public.credential_vault(credential_type);
CREATE INDEX IF NOT EXISTS idx_cred_vault_service ON public.credential_vault(service_name);
CREATE INDEX IF NOT EXISTS idx_cred_vault_status ON public.credential_vault(status);

ALTER TABLE public.credential_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cred_vault_all" ON public.credential_vault FOR ALL USING (auth.uid() IS NOT NULL);

-- 7. CREDENTIAL AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.credential_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES public.credential_vault(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created','accessed','updated','rotated','revoked','deleted')),
  actor_id TEXT,
  actor_type TEXT DEFAULT 'user' CHECK (actor_type IN ('user','agent','workflow','system')),
  ip_address TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cred_audit_cred ON public.credential_audit_logs(credential_id, created_at DESC);

ALTER TABLE public.credential_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cred_audit_all" ON public.credential_audit_logs FOR ALL USING (auth.uid() IS NOT NULL);

-- 8. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp','slack','push','sms','in_app','webhook')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','failed','cancelled')),
  recipient_id UUID,
  recipient_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  body_html TEXT,
  template_id UUID,
  template_vars JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  source_type TEXT DEFAULT 'system' CHECK (source_type IN ('workflow','agent','system','user')),
  source_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_channel_status ON public.notifications(channel, status);
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_in_app ON public.notifications(recipient_id, status) WHERE channel = 'in_app';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_all" ON public.notifications FOR ALL USING (auth.uid() IS NOT NULL);

-- 9. NOTIFICATION TEMPLATES
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  body_html_template TEXT,
  variables TEXT[] DEFAULT ARRAY[]::TEXT[],
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_tpl_all" ON public.notification_templates FOR ALL USING (auth.uid() IS NOT NULL);

-- 10. AUTOMATION TEMPLATES
CREATE TABLE IF NOT EXISTS public.automation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  long_description TEXT DEFAULT '',
  category TEXT NOT NULL,
  difficulty TEXT DEFAULT 'intermediate' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  icon TEXT DEFAULT '⚡',
  color TEXT DEFAULT '#4D96FF',
  trigger_type TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  required_integrations TEXT[] DEFAULT ARRAY[]::TEXT[],
  required_credentials TEXT[] DEFAULT ARRAY[]::TEXT[],
  estimated_setup_minutes INTEGER DEFAULT 10,
  installs INTEGER DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  author TEXT DEFAULT 'Nexus AI',
  version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_tpl_slug ON public.automation_templates(slug);
CREATE INDEX IF NOT EXISTS idx_auto_tpl_category ON public.automation_templates(category);

ALTER TABLE public.automation_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auto_tpl_all" ON public.automation_templates FOR ALL USING (auth.uid() IS NOT NULL);

-- Helper function for template installs counter
CREATE OR REPLACE FUNCTION public.increment_template_installs(template_uuid UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.automation_templates SET installs = installs + 1 WHERE id = template_uuid;
END;
$$;

-- 11. INSTALLED TEMPLATES
CREATE TABLE IF NOT EXISTS public.installed_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.automation_templates(id) ON DELETE CASCADE,
  workflow_id UUID,
  config_overrides JSONB DEFAULT '{}',
  status TEXT DEFAULT 'installed' CHECK (status IN ('installed','configured','running','paused','error')),
  installed_at TIMESTAMPTZ DEFAULT now(),
  installed_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.installed_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "installed_tpl_all" ON public.installed_templates FOR ALL USING (auth.uid() IS NOT NULL);

-- 12. EXECUTION HISTORY
CREATE TABLE IF NOT EXISTS public.execution_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_type TEXT NOT NULL CHECK (execution_type IN ('workflow','agent','automation','webhook','schedule','manual')),
  source_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  status TEXT DEFAULT 'running' CHECK (status IN ('running','success','failed','cancelled','timeout','waiting')),
  trigger TEXT NOT NULL,
  input_data JSONB DEFAULT '{}',
  output_data JSONB,
  error TEXT,
  error_stack TEXT,
  steps JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  tokens_used INTEGER DEFAULT 0,
  cost_brl NUMERIC(10,4) DEFAULT 0,
  retry_of UUID,
  parent_execution_id UUID,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_exec_hist_type ON public.execution_history(execution_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_exec_hist_source ON public.execution_history(source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_exec_hist_status ON public.execution_history(status);
CREATE INDEX IF NOT EXISTS idx_exec_hist_started ON public.execution_history(started_at DESC);

ALTER TABLE public.execution_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exec_hist_all" ON public.execution_history FOR ALL USING (auth.uid() IS NOT NULL);

-- 13. CONNECTOR REGISTRY
CREATE TABLE IF NOT EXISTS public.connector_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon TEXT DEFAULT '🔌',
  color TEXT DEFAULT '#4D96FF',
  category TEXT NOT NULL,
  auth_type TEXT DEFAULT 'api_key',
  auth_config_schema JSONB DEFAULT '{}',
  base_url TEXT NOT NULL,
  api_version TEXT DEFAULT 'v1',
  operations JSONB NOT NULL DEFAULT '[]',
  rate_limit_per_minute INTEGER DEFAULT 60,
  supports_webhooks BOOLEAN DEFAULT false,
  supports_polling BOOLEAN DEFAULT false,
  health_check_endpoint TEXT,
  documentation_url TEXT DEFAULT '',
  status TEXT DEFAULT 'available',
  version TEXT DEFAULT '1.0.0',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conn_reg_slug ON public.connector_registry(slug);
CREATE INDEX IF NOT EXISTS idx_conn_reg_category ON public.connector_registry(category);

ALTER TABLE public.connector_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conn_reg_all" ON public.connector_registry FOR ALL USING (auth.uid() IS NOT NULL);

-- 14. CONNECTOR INSTANCES
CREATE TABLE IF NOT EXISTS public.connector_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES public.connector_registry(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  credential_id UUID,
  config JSONB DEFAULT '{}',
  status TEXT DEFAULT 'connected',
  last_health_check TIMESTAMPTZ,
  health_check_result JSONB,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.connector_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conn_inst_all" ON public.connector_instances FOR ALL USING (auth.uid() IS NOT NULL);

-- 15. TASK QUEUES
CREATE TABLE IF NOT EXISTS public.task_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  strategy TEXT DEFAULT 'fifo' CHECK (strategy IN ('fifo','lifo','priority')),
  max_concurrency INTEGER DEFAULT 5,
  max_size INTEGER DEFAULT 10000,
  rate_limit_per_second INTEGER DEFAULT 10,
  default_timeout_ms INTEGER DEFAULT 30000,
  default_max_retries INTEGER DEFAULT 3,
  dead_letter_queue_id UUID,
  is_paused BOOLEAN DEFAULT false,
  current_size INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  avg_processing_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.task_queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_queues_all" ON public.task_queues FOR ALL USING (auth.uid() IS NOT NULL);

-- 16. QUEUE ITEMS
CREATE TABLE IF NOT EXISTS public.queue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES public.task_queues(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','dead_letter')),
  payload JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error TEXT,
  attempt INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  timeout_ms INTEGER DEFAULT 30000,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  locked_by TEXT,
  locked_until TIMESTAMPTZ,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_items_queue ON public.queue_items(queue_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_queue_items_priority ON public.queue_items(queue_id, priority DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_queue_items_lock ON public.queue_items(locked_until) WHERE status = 'processing';

ALTER TABLE public.queue_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue_items_all" ON public.queue_items FOR ALL USING (auth.uid() IS NOT NULL);

-- 17. BATCH JOBS
CREATE TABLE IF NOT EXISTS public.batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','running','paused','completed','failed','cancelled','partial')),
  total_items INTEGER NOT NULL,
  processed_items INTEGER DEFAULT 0,
  successful_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  skipped_items INTEGER DEFAULT 0,
  batch_size INTEGER DEFAULT 100,
  concurrency INTEGER DEFAULT 1,
  error_policy TEXT DEFAULT 'continue_all' CHECK (error_policy IN ('stop_on_first','continue_all','threshold')),
  error_threshold_pct NUMERIC(5,2) DEFAULT 10,
  current_batch INTEGER DEFAULT 0,
  total_batches INTEGER DEFAULT 0,
  progress_pct INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  estimated_completion TIMESTAMPTZ,
  duration_ms INTEGER,
  avg_item_ms INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON public.batch_jobs(status);

ALTER TABLE public.batch_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batch_jobs_all" ON public.batch_jobs FOR ALL USING (auth.uid() IS NOT NULL);
