-- ADR-004: Create planned tables for workflow checkpointing, handoffs, and agent configs
-- These tables were anticipated by services but never created, causing runtime failures.
-- Ref: docs/adr/004-dynamic-table-access.md

-- 1. WORKFLOW EXECUTIONS: tracks full execution lifecycle
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'paused', 'completed', 'failed', 'cancelled')),
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  error TEXT,
  total_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_duration_ms INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_user ON workflow_executions(user_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);

ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own workflow executions"
  ON workflow_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own workflow executions"
  ON workflow_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own workflow executions"
  ON workflow_executions FOR UPDATE
  USING (auth.uid() = user_id);

-- 2. WORKFLOW CHECKPOINTS: per-node state snapshots for crash recovery & time-travel
CREATE TABLE IF NOT EXISTS workflow_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  step_index INTEGER NOT NULL DEFAULT 0,
  state JSONB NOT NULL DEFAULT '{}',
  node_input JSONB,
  node_output JSONB,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkpoints_execution ON workflow_checkpoints(execution_id);
CREATE INDEX idx_checkpoints_step ON workflow_checkpoints(execution_id, step_index);

ALTER TABLE workflow_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see checkpoints of own executions"
  ON workflow_checkpoints FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflow_executions we
      WHERE we.id = workflow_checkpoints.execution_id
        AND we.user_id = auth.uid()
    )
  );

CREATE POLICY "Users create checkpoints for own executions"
  ON workflow_checkpoints FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflow_executions we
      WHERE we.id = workflow_checkpoints.execution_id
        AND we.user_id = auth.uid()
    )
  );

-- 3. WORKFLOW HANDOFFS: agent-to-agent execution transfers
CREATE TABLE IF NOT EXISTS workflow_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  target_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'delegation'
    CHECK (reason IN ('skill_mismatch', 'escalation', 'delegation', 'triage',
                      'human_required', 'load_balancing', 'specialization', 'fallback', 'custom')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'failed', 'cancelled')),
  context JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_handoffs_source ON workflow_handoffs(source_agent_id);
CREATE INDEX idx_handoffs_target ON workflow_handoffs(target_agent_id);
CREATE INDEX idx_handoffs_user ON workflow_handoffs(user_id);
CREATE INDEX idx_handoffs_status ON workflow_handoffs(status);

ALTER TABLE workflow_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own handoffs"
  ON workflow_handoffs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own handoffs"
  ON workflow_handoffs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own handoffs"
  ON workflow_handoffs FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. AGENT CONFIGS: A2A-compliant agent card storage
CREATE TABLE IF NOT EXISTS agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_version TEXT NOT NULL DEFAULT '1.0',
  card JSONB NOT NULL DEFAULT '{}',
  capabilities JSONB NOT NULL DEFAULT '{}',
  skills JSONB NOT NULL DEFAULT '[]',
  authentication JSONB,
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_agent_configs_agent ON agent_configs(agent_id);
CREATE INDEX idx_agent_configs_user ON agent_configs(user_id);
CREATE INDEX idx_agent_configs_published ON agent_configs(published) WHERE published = true;

ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own agent configs"
  ON agent_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own agent configs"
  ON agent_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own agent configs"
  ON agent_configs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can see published agent cards"
  ON agent_configs FOR SELECT
  USING (published = true);
