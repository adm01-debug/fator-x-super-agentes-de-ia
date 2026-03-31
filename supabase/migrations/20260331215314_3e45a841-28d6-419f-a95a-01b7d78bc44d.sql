
-- Agents: frequently filtered by user_id and sorted by updated_at
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON public.agents (user_id);
CREATE INDEX IF NOT EXISTS idx_agents_updated_at ON public.agents (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_user_updated ON public.agents (user_id, updated_at DESC);

-- Agent traces: filtered by agent_id and sorted by created_at
CREATE INDEX IF NOT EXISTS idx_agent_traces_agent_id ON public.agent_traces (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_user_created ON public.agent_traces (user_id, created_at DESC);

-- Agent usage: filtered by agent_id and date
CREATE INDEX IF NOT EXISTS idx_agent_usage_agent_date ON public.agent_usage (agent_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_usage_user_id ON public.agent_usage (user_id);

-- Prompt versions: filtered by agent_id and sorted by version
CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent_version ON public.prompt_versions (agent_id, version DESC);

-- Workspace members: frequently joined on user_id and workspace_id
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members (user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members (workspace_id);

-- Oracle history: filtered by user_id and sorted by created_at
CREATE INDEX IF NOT EXISTS idx_oracle_history_user_created ON public.oracle_history (user_id, created_at DESC);

-- Knowledge bases: filtered by workspace_id
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_workspace_id ON public.knowledge_bases (workspace_id);

-- Evaluation runs: filtered by workspace_id
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_workspace_id ON public.evaluation_runs (workspace_id);
