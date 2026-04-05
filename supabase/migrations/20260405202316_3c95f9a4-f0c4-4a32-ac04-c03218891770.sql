-- Forensic Snapshots: immutable state snapshots with SHA-256 chain integrity
CREATE TABLE IF NOT EXISTS public.forensic_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id TEXT NOT NULL,
  agent_id UUID NOT NULL,
  step_index INTEGER NOT NULL DEFAULT 0,
  decision_type TEXT NOT NULL DEFAULT 'state_mutation',
  state_before JSONB NOT NULL DEFAULT '{}',
  state_after JSONB NOT NULL DEFAULT '{}',
  decision_rationale TEXT NOT NULL DEFAULT '',
  input_hash TEXT NOT NULL,
  output_hash TEXT NOT NULL,
  chain_hash TEXT NOT NULL,
  previous_hash TEXT NOT NULL DEFAULT 'genesis',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.forensic_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can SELECT snapshots for agents they own
CREATE POLICY "Users can view own forensic snapshots"
  ON public.forensic_snapshots
  FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT a.id FROM agents a WHERE a.user_id = auth.uid()
    )
  );

-- Users can INSERT snapshots for agents they own
CREATE POLICY "Users can create forensic snapshots"
  ON public.forensic_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id IN (
      SELECT a.id FROM agents a WHERE a.user_id = auth.uid()
    )
  );

-- BLOCK updates — immutability guarantee
CREATE POLICY "Block updates on forensic snapshots"
  ON public.forensic_snapshots
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- BLOCK deletes — immutability guarantee
CREATE POLICY "Block deletes on forensic snapshots"
  ON public.forensic_snapshots
  FOR DELETE
  TO authenticated
  USING (false);

-- Index for fast chain traversal
CREATE INDEX idx_forensic_snapshots_execution_step
  ON public.forensic_snapshots (execution_id, step_index ASC);

-- Index for agent lookup
CREATE INDEX idx_forensic_snapshots_agent
  ON public.forensic_snapshots (agent_id);

-- Index for hash chain verification
CREATE INDEX idx_forensic_snapshots_chain_hash
  ON public.forensic_snapshots (chain_hash);