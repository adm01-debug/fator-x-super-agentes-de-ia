-- Tabela: agent_graphs
CREATE TABLE public.agent_graphs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  entry_node_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_graphs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read graphs" ON public.agent_graphs FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY "members create graphs" ON public.agent_graphs FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND created_by = auth.uid());

CREATE POLICY "members update graphs" ON public.agent_graphs FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY "members delete graphs" ON public.agent_graphs FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id));

CREATE TRIGGER trg_agent_graphs_updated BEFORE UPDATE ON public.agent_graphs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_agent_graphs_workspace ON public.agent_graphs(workspace_id);

-- Tabela: graph_executions
CREATE TABLE public.graph_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  graph_id UUID NOT NULL REFERENCES public.agent_graphs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  current_node_id TEXT,
  trace JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_output TEXT,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.graph_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read executions" ON public.graph_executions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (workspace_id IS NOT NULL AND workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))));

CREATE POLICY "users create executions" ON public.graph_executions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own executions" ON public.graph_executions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own executions" ON public.graph_executions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_graph_exec_graph ON public.graph_executions(graph_id);
CREATE INDEX idx_graph_exec_user ON public.graph_executions(user_id);