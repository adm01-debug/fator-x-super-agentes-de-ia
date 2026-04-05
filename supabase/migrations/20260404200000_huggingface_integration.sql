-- ═══════════════════════════════════════════════════════════
-- FATOR X — Migration: HuggingFace Integration (Fase 2)
-- Data: 2026-04-04
-- ═══════════════════════════════════════════════════════════

-- ═══ 1. Model Pricing — Add HuggingFace / open-source models ═══
INSERT INTO public.model_pricing (model_pattern, input_cost_per_1k, output_cost_per_1k) VALUES
  ('llama-4', 0.00017, 0.0004),
  ('qwen3', 0.00015, 0.0003),
  ('mistral-small', 0.0001, 0.0003),
  ('gemma-3', 0.00005, 0.00015),
  ('deepseek-v3', 0.0003, 0.0009),
  ('deepseek-r1', 0.0005, 0.002)
ON CONFLICT (model_pattern) DO NOTHING;

-- ═══ 2. Deploy Channels — Add huggingface_space ═══
-- Update CHECK constraint to include new channel
ALTER TABLE public.deploy_connections 
  DROP CONSTRAINT IF EXISTS deploy_connections_channel_check;
ALTER TABLE public.deploy_connections 
  ADD CONSTRAINT deploy_connections_channel_check 
  CHECK (channel IN ('api','whatsapp','web_chat','slack','email','bitrix24','telegram','discord','huggingface_space'));
