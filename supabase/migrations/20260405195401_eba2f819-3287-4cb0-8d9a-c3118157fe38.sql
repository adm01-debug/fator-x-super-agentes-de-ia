
-- ══════════════════════════════════════════════════
-- 1. Register updated_at triggers on all tables
-- ══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
      AND table_name NOT IN ('audit_log')
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I', tbl, tbl
    );
    EXECUTE format(
      'CREATE TRIGGER update_%I_updated_at
       BEFORE UPDATE ON public.%I
       FOR EACH ROW
       EXECUTE FUNCTION public.update_updated_at_column()', tbl, tbl
    );
  END LOOP;
END;
$$;

-- ══════════════════════════════════════════════════
-- 2. Foreign Key constraints (idempotent with IF NOT EXISTS)
-- ══════════════════════════════════════════════════

-- agent_traces → agents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_traces_agent_id_fkey') THEN
    ALTER TABLE public.agent_traces ADD CONSTRAINT agent_traces_agent_id_fkey
      FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;
  END IF;
END $$;

-- agent_usage → agents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_usage_agent_id_fkey') THEN
    ALTER TABLE public.agent_usage ADD CONSTRAINT agent_usage_agent_id_fkey
      FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;
  END IF;
END $$;

-- agent_versions → agents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_versions_agent_id_fkey') THEN
    ALTER TABLE public.agent_versions ADD CONSTRAINT agent_versions_agent_id_fkey
      FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;
  END IF;
END $$;

-- alerts → agents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alerts_agent_id_fkey') THEN
    ALTER TABLE public.alerts ADD CONSTRAINT alerts_agent_id_fkey
      FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- alerts → workspaces
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alerts_workspace_id_fkey') THEN
    ALTER TABLE public.alerts ADD CONSTRAINT alerts_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- api_keys → workspaces
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_workspace_id_fkey') THEN
    ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- chunks → documents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chunks_document_id_fkey') THEN
    ALTER TABLE public.chunks ADD CONSTRAINT chunks_document_id_fkey
      FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;
  END IF;
END $$;

-- collections → knowledge_bases
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collections_knowledge_base_id_fkey') THEN
    ALTER TABLE public.collections ADD CONSTRAINT collections_knowledge_base_id_fkey
      FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;
  END IF;
END $$;

-- deploy_connections → agents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deploy_connections_agent_id_fkey') THEN
    ALTER TABLE public.deploy_connections ADD CONSTRAINT deploy_connections_agent_id_fkey
      FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;
  END IF;
END $$;

-- deploy_connections → workspaces
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deploy_connections_workspace_id_fkey') THEN
    ALTER TABLE public.deploy_connections ADD CONSTRAINT deploy_connections_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- documents → collections
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_collection_id_fkey') THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_collection_id_fkey
      FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;
  END IF;
END $$;

-- evaluation_runs → agents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evaluation_runs_agent_id_fkey') THEN
    ALTER TABLE public.evaluation_runs ADD CONSTRAINT evaluation_runs_agent_id_fkey
      FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- evaluation_runs → workspaces
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evaluation_runs_workspace_id_fkey') THEN
    ALTER TABLE public.evaluation_runs ADD CONSTRAINT evaluation_runs_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- sessions → agents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_agent_id_fkey') THEN
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_agent_id_fkey
      FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- workflow_runs → workflows
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_runs_workflow_id_fkey') THEN
    ALTER TABLE public.workflow_runs ADD CONSTRAINT workflow_runs_workflow_id_fkey
      FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;
  END IF;
END $$;

-- workflow_steps → workflows
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_steps_workflow_id_fkey') THEN
    ALTER TABLE public.workflow_steps ADD CONSTRAINT workflow_steps_workflow_id_fkey
      FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;
  END IF;
END $$;

-- workflow_steps → agents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_steps_agent_id_fkey') THEN
    ALTER TABLE public.workflow_steps ADD CONSTRAINT workflow_steps_agent_id_fkey
      FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- prompt_versions → agents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prompt_versions_agent_id_fkey') THEN
    ALTER TABLE public.prompt_versions ADD CONSTRAINT prompt_versions_agent_id_fkey
      FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;
  END IF;
END $$;

-- session_traces → sessions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_traces_session_id_fkey') THEN
    ALTER TABLE public.session_traces ADD CONSTRAINT session_traces_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- trace_events → session_traces
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trace_events_session_trace_id_fkey') THEN
    ALTER TABLE public.trace_events ADD CONSTRAINT trace_events_session_trace_id_fkey
      FOREIGN KEY (session_trace_id) REFERENCES public.session_traces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- test_cases → evaluation_datasets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'test_cases_dataset_id_fkey') THEN
    ALTER TABLE public.test_cases ADD CONSTRAINT test_cases_dataset_id_fkey
      FOREIGN KEY (dataset_id) REFERENCES public.evaluation_datasets(id) ON DELETE CASCADE;
  END IF;
END $$;

-- vector_indexes → knowledge_bases
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vector_indexes_knowledge_base_id_fkey') THEN
    ALTER TABLE public.vector_indexes ADD CONSTRAINT vector_indexes_knowledge_base_id_fkey
      FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;
  END IF;
END $$;

-- agent_memories → workspaces
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_memories_workspace_id_fkey') THEN
    ALTER TABLE public.agent_memories ADD CONSTRAINT agent_memories_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- workspace_members → workspaces
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_members_workspace_id_fkey') THEN
    ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- workspace_secrets → workspaces
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_secrets_workspace_id_fkey') THEN
    ALTER TABLE public.workspace_secrets ADD CONSTRAINT workspace_secrets_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ══════════════════════════════════════════════════
-- 3. NOT NULL on critical fields
-- ══════════════════════════════════════════════════

-- workspace_members.user_id must not be null (RLS depends on it)
UPDATE public.workspace_members SET user_id = (SELECT owner_id FROM public.workspaces WHERE workspaces.id = workspace_members.workspace_id) WHERE user_id IS NULL;
ALTER TABLE public.workspace_members ALTER COLUMN user_id SET NOT NULL;

-- agents.workspace_id — make workspace membership explicit
-- (skip for now to avoid breaking existing data without workspace)

-- ══════════════════════════════════════════════════
-- 4. Indices on frequently queried columns
-- ══════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_agents_user_id ON public.agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_workspace_id ON public.agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);
CREATE INDEX IF NOT EXISTS idx_agent_traces_agent_id ON public.agent_traces(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_user_id ON public.agent_traces(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_created_at ON public.agent_traces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_usage_agent_id ON public.agent_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_date ON public.agent_usage(date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_versions_agent_id ON public.agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_alerts_workspace_id ON public.alerts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON public.audit_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON public.chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_collections_kb_id ON public.collections(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_deploy_connections_agent_id ON public.deploy_connections(agent_id);
CREATE INDEX IF NOT EXISTS idx_documents_collection_id ON public.documents(collection_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_workspace_id ON public.evaluation_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_workspace_id ON public.knowledge_bases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_oracle_history_user_id ON public.oracle_history(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_history_created_at ON public.oracle_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent_id ON public.prompt_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON public.sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_workspace_id ON public.usage_records(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON public.workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON public.workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflows_workspace_id ON public.workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tool_integrations_workspace_id ON public.tool_integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_guardrail_policies_workspace_id ON public.guardrail_policies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_budgets_workspace_id ON public.budgets(workspace_id);
