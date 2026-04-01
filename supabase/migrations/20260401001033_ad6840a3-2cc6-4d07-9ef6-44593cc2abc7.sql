
-- Performance indices for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON public.agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_workspace_id ON public.agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_updated_at ON public.agents(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_traces_agent_id ON public.agent_traces(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_user_id ON public.agent_traces(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_created_at ON public.agent_traces(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_usage_agent_id ON public.agent_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_date ON public.agent_usage(date DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent_id ON public.prompt_versions(agent_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_bases_workspace_id ON public.knowledge_bases(workspace_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_runs_workspace_id ON public.evaluation_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_agent_id ON public.evaluation_runs(agent_id);

CREATE INDEX IF NOT EXISTS idx_oracle_history_user_id ON public.oracle_history(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_history_created_at ON public.oracle_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
