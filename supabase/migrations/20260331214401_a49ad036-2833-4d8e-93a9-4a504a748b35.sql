
-- Performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_agents_user_status ON public.agents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_agents_user_updated ON public.agents(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_traces_agent_created ON public.agent_traces(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_traces_level ON public.agent_traces(level);
CREATE INDEX IF NOT EXISTS idx_agent_traces_user_level ON public.agent_traces(user_id, level);
CREATE INDEX IF NOT EXISTS idx_agent_usage_agent_date ON public.agent_usage(agent_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_usage_user_date ON public.agent_usage(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_secrets_workspace ON public.workspace_secrets(workspace_id, key_name);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent ON public.prompt_versions(agent_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_history_user ON public.oracle_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_workspace ON public.evaluation_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_workspace ON public.knowledge_bases(workspace_id);
