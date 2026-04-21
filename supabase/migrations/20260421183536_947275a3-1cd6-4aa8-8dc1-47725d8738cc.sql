
-- ═══════════════════════════════════════════════════════════════
-- MOCK DATA: MÓDULO AGENTES — Catálogo completo + métricas
-- ═══════════════════════════════════════════════════════════════

-- 1) Adicionar novos agentes do catálogo (squads completas) para cada usuário existente
DO $$
DECLARE
  u RECORD;
  new_agents JSONB := '[
    {"name":"Nexus Supervisor","mission":"Orquestrador geral — roteia tarefas entre squads e mantém contexto corporativo","persona":"coordinator","emoji":"🧠","model":"claude-sonnet-4.6","reasoning":"plan_execute","status":"production","tags":["core","supervisor","orchestrator"]},
    {"name":"Oracle Multi-LLM","mission":"Conselho de modelos (Claude Opus + GPT-5 + Gemini) para decisões críticas","persona":"analyst","emoji":"🔮","model":"claude-opus-4.6","reasoning":"reflection","status":"production","tags":["core","oracle","council"]},
    {"name":"Cérebro Corporativo","mission":"Memória semântica e episódica da empresa com RAG agentic","persona":"specialist","emoji":"🧬","model":"gemini-2.5-pro","reasoning":"react","status":"monitoring","tags":["core","memory","rag"]},
    {"name":"Pink Sales","mission":"SDR autônomo — qualifica leads no Bitrix24 e dispara propostas","persona":"specialist","emoji":"💼","model":"gpt-5","reasoning":"react","status":"production","tags":["commercial","crm","bitrix24"]},
    {"name":"Prospector Pro","mission":"Busca empresas no LinkedIn/Apollo, enriquece e adiciona ao funil","persona":"autonomous","emoji":"🎯","model":"gpt-5-mini","reasoning":"react","status":"staging","tags":["commercial","prospecting"]},
    {"name":"Mockup Designer","mission":"Gera mockups fotorealistas de brindes com logo do cliente","persona":"creative","emoji":"🎨","model":"gemini-2.5-pro","reasoning":"cot","status":"production","tags":["commercial","multimodal","design"]},
    {"name":"Order Tracker","mission":"Acompanha pedidos do fornecedor à entrega, atualiza CRM","persona":"specialist","emoji":"📦","model":"gemini-2.5-flash","reasoning":"react","status":"production","tags":["operations","fulfillment"]},
    {"name":"Sourcing Hunter","mission":"Cota produtos em múltiplos fornecedores, compara preço e prazo","persona":"analyst","emoji":"🔎","model":"gpt-5-mini","reasoning":"tot","status":"production","tags":["operations","sourcing"]},
    {"name":"QA Inspector","mission":"Valida amostras com visão computacional antes do envio","persona":"specialist","emoji":"✅","model":"gemini-2.5-pro","reasoning":"react","status":"testing","tags":["operations","vision","qa"]},
    {"name":"Finance Analyst","mission":"Concilia faturas, projeta fluxo de caixa e detecta anomalias","persona":"analyst","emoji":"💰","model":"gpt-5","reasoning":"cot","status":"production","tags":["finance","analytics"]},
    {"name":"HR Recruiter","mission":"Triagem de currículos e agendamento de entrevistas","persona":"assistant","emoji":"👥","model":"claude-sonnet-4.6","reasoning":"react","status":"configured","tags":["hr","recruiting"]},
    {"name":"n8n Architect","mission":"Cria e mantém workflows n8n, monitora execuções","persona":"specialist","emoji":"⚙️","model":"gpt-5","reasoning":"plan_execute","status":"production","tags":["it","automation","n8n"]},
    {"name":"SecOps Sentinel","mission":"Monitora logs, detecta intrusões, responde a incidentes","persona":"autonomous","emoji":"🛡️","model":"claude-opus-4.6","reasoning":"reflection","status":"monitoring","tags":["it","security"]},
    {"name":"Marketing Strategist","mission":"Planeja campanhas, gera copy e analisa performance","persona":"creative","emoji":"📣","model":"gpt-5","reasoning":"cot","status":"staging","tags":["marketing","copy"]},
    {"name":"Chief of Staff","mission":"Sumariza reuniões, prioriza inbox executivo, prepara briefings","persona":"coordinator","emoji":"🎩","model":"claude-opus-4.6","reasoning":"plan_execute","status":"production","tags":["executive","productivity"]}
  ]'::JSONB;
  agent_def JSONB;
BEGIN
  FOR u IN SELECT DISTINCT user_id, workspace_id FROM agents LOOP
    FOR agent_def IN SELECT * FROM jsonb_array_elements(new_agents) LOOP
      INSERT INTO agents (user_id, workspace_id, name, mission, persona, avatar_emoji, model, reasoning, status, version, tags, config)
      SELECT
        u.user_id,
        u.workspace_id,
        agent_def->>'name',
        agent_def->>'mission',
        agent_def->>'persona',
        agent_def->>'emoji',
        agent_def->>'model',
        agent_def->>'reasoning',
        (agent_def->>'status')::agent_status,
        floor(random() * 5 + 1)::int,
        ARRAY(SELECT jsonb_array_elements_text(agent_def->'tags')),
        jsonb_build_object(
          'temperature', round((random() * 0.7 + 0.2)::numeric, 2),
          'max_tokens', (ARRAY[2048, 4096, 8192])[floor(random()*3+1)],
          'rag_enabled', random() > 0.3,
          'memory_enabled', random() > 0.4,
          'tools', jsonb_build_array('web_search', 'database_query', 'email_send')
        )
      WHERE NOT EXISTS (
        SELECT 1 FROM agents WHERE user_id = u.user_id AND name = agent_def->>'name'
      );
    END LOOP;
  END LOOP;
END $$;

-- 2) Versões: 3-5 versões por agente
INSERT INTO agent_versions (agent_id, version, name, model, persona, mission, config, change_summary, created_by, created_at)
SELECT
  a.id,
  v.version,
  a.name,
  a.model,
  a.persona,
  a.mission,
  a.config,
  (ARRAY[
    'Versão inicial do agente',
    'Refinou o prompt do sistema para reduzir alucinações',
    'Adicionou ferramentas de busca web e RAG',
    'Ajuste de temperatura e top_p para mais consistência',
    'Migrou modelo para versão mais recente',
    'Incluiu guardrails de PII e bloqueio de tópicos',
    'Otimização de custo: fallback para modelo mini',
    'Habilitou memória episódica e procedural'
  ])[floor(random()*8+1)],
  a.user_id,
  now() - (interval '1 day' * (a.version - v.version) * 7) - (random() * interval '6 hours')
FROM agents a
CROSS JOIN LATERAL generate_series(1, GREATEST(a.version, 3)) AS v(version)
WHERE NOT EXISTS (SELECT 1 FROM agent_versions WHERE agent_id = a.id)
ON CONFLICT (agent_id, version) DO NOTHING;

-- 3) Usage: 30 dias de dados para cada agente
INSERT INTO agent_usage (agent_id, user_id, date, requests, tokens_input, tokens_output, total_cost_usd, avg_latency_ms, error_count)
SELECT
  a.id,
  a.user_id,
  (CURRENT_DATE - d)::date,
  -- requests: produção tem mais volume
  CASE
    WHEN a.status = 'production' THEN floor(random() * 800 + 200)::int
    WHEN a.status = 'monitoring' THEN floor(random() * 500 + 100)::int
    WHEN a.status = 'staging' THEN floor(random() * 200 + 30)::int
    WHEN a.status = 'testing' THEN floor(random() * 80 + 10)::int
    ELSE floor(random() * 20 + 1)::int
  END,
  floor(random() * 50000 + 5000)::int,
  floor(random() * 30000 + 2000)::int,
  round((random() * 8 + 0.1)::numeric, 6),
  floor(random() * 1500 + 200)::int,
  floor(random() * 5)::int
FROM agents a
CROSS JOIN generate_series(0, 29) AS d
WHERE NOT EXISTS (
  SELECT 1 FROM agent_usage WHERE agent_id = a.id AND date = (CURRENT_DATE - d)::date
)
ON CONFLICT (agent_id, date) DO NOTHING;

-- 4) Traces: 60 traces recentes por agente (últimas 48h)
INSERT INTO agent_traces (agent_id, user_id, session_id, level, event, input, output, metadata, latency_ms, tokens_used, cost_usd, created_at)
SELECT
  a.id,
  a.user_id,
  'sess_' || substr(md5(random()::text), 1, 12),
  CASE
    WHEN random() < 0.78 THEN 'info'::trace_level
    WHEN random() < 0.92 THEN 'warning'::trace_level
    WHEN random() < 0.98 THEN 'error'::trace_level
    ELSE 'critical'::trace_level
  END,
  (ARRAY['llm.completion', 'tool.call', 'rag.retrieve', 'memory.query', 'guardrail.check', 'agent.handoff'])[floor(random()*6+1)],
  jsonb_build_object('prompt', 'Mock input ' || t.n, 'tokens', floor(random()*1000+50)::int),
  jsonb_build_object('response', 'Mock output ' || t.n, 'finish_reason', 'stop'),
  jsonb_build_object('model', a.model, 'temperature', 0.7, 'workspace', a.workspace_id),
  floor(random() * 2500 + 150)::int,
  floor(random() * 3500 + 100)::int,
  round((random() * 0.05)::numeric, 6),
  now() - (random() * interval '48 hours')
FROM agents a
CROSS JOIN generate_series(1, 60) AS t(n)
WHERE (SELECT COUNT(*) FROM agent_traces WHERE agent_id = a.id) < 10;

-- 5) Alerts: 2-6 alertas por agente em produção/monitoring
INSERT INTO alerts (workspace_id, agent_id, severity, title, message, is_resolved, resolved_at, created_at)
SELECT
  a.workspace_id,
  a.id,
  (ARRAY['info', 'warning', 'warning', 'critical'])[floor(random()*4+1)],
  alert_title,
  alert_message,
  random() > 0.4,
  CASE WHEN random() > 0.4 THEN now() - (random() * interval '3 days') END,
  now() - (random() * interval '14 days')
FROM agents a
CROSS JOIN LATERAL (
  VALUES
    ('Latência acima do SLO', 'P95 ultrapassou 2s nas últimas 15 min'),
    ('Taxa de erro elevada', 'Taxa de erro atingiu 8% — investigar'),
    ('Custo diário próximo do limite', '85% do orçamento diário consumido'),
    ('Tool call falhou', 'Ferramenta bitrix24.create_deal retornou 500'),
    ('Token budget excedido', 'Sessão consumiu mais de 50k tokens'),
    ('Guardrail acionado', 'PII detectada na saída — bloqueio aplicado'),
    ('Modelo fallback ativado', 'Primário indisponível, usando fallback'),
    ('Memória semântica desatualizada', 'Última sincronização há 7 dias')
) AS t(alert_title, alert_message)
WHERE a.status IN ('production', 'monitoring', 'staging')
  AND random() > 0.55
  AND NOT EXISTS (SELECT 1 FROM alerts WHERE agent_id = a.id LIMIT 1);
