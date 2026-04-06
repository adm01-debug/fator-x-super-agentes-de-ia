-- ═══════════════════════════════════════════════════════════
-- Nexus Agents Studio — pg_cron Job Setup
-- Run this in Supabase SQL Editor AFTER enabling pg_cron extension
-- ═══════════════════════════════════════════════════════════

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. CRON EXECUTOR: Process scheduled automations every minute
SELECT cron.schedule(
  'nexus-cron-executor',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cron-executor',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2. QUEUE WORKER: Process task queues every minute
SELECT cron.schedule(
  'nexus-queue-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/queue-worker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"batch_size": 10}'::jsonb
  );
  $$
);

-- 3. HEALTH CHECK: Run every 5 minutes
SELECT cron.schedule(
  'nexus-health-check',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/health-check',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verify jobs were created
SELECT jobid, schedule, command FROM cron.job ORDER BY jobid;
