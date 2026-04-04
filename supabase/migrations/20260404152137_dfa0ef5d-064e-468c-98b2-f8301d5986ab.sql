
-- Performance indexes for frequent queries
CREATE INDEX IF NOT EXISTS idx_agent_traces_agent_id ON public.agent_traces(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_user_created ON public.agent_traces(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_usage_agent_date ON public.agent_usage(agent_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_usage_user_date ON public.agent_usage(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memories_type_ws ON public.agent_memories(memory_type, workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_created ON public.agent_memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created ON public.audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_user_status ON public.agents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON public.agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflows_workspace ON public.workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent ON public.sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent ON public.prompt_versions(agent_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON public.workflow_runs(workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deploy_connections_agent ON public.deploy_connections(agent_id);
CREATE INDEX IF NOT EXISTS idx_oracle_history_user ON public.oracle_history(user_id, created_at DESC);
