-- Nexus Agents Studio — Workflow Checkpointing & Time-Travel
-- Enables durable execution, crash recovery, and state inspection

-- ============================================
-- Table: workflow_executions
-- Tracks each execution run of a workflow
-- ============================================
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'paused', 'completed', 'failed', 'cancelled')),
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  error TEXT,
  total_cost_usd NUMERIC(10, 6) DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_duration_ms INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Table: workflow_checkpoints
-- Captures state snapshot after each node execution
-- ============================================
CREATE TABLE IF NOT EXISTS public.workflow_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  step_index INTEGER NOT NULL DEFAULT 0,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  node_input JSONB,
  node_output JSONB,
  cost_usd NUMERIC(10, 6) DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Table: workflow_handoffs
-- Tracks agent-to-agent context transfers
-- ============================================
CREATE TABLE IF NOT EXISTS public.workflow_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
  source_agent_id UUID,
  target_agent_id UUID,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON public.workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON public.workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_execution_id ON public.workflow_checkpoints(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_node_id ON public.workflow_checkpoints(node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_step ON public.workflow_checkpoints(execution_id, step_index);
CREATE INDEX IF NOT EXISTS idx_workflow_handoffs_execution_id ON public.workflow_handoffs(execution_id);

-- RLS Policies
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workflow executions"
  ON public.workflow_executions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view checkpoints of own executions"
  ON public.workflow_checkpoints FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workflow_executions we
      WHERE we.id = workflow_checkpoints.execution_id
      AND we.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view handoffs of own executions"
  ON public.workflow_handoffs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workflow_executions we
      WHERE we.id = workflow_handoffs.execution_id
      AND we.user_id = auth.uid()
    )
  );
