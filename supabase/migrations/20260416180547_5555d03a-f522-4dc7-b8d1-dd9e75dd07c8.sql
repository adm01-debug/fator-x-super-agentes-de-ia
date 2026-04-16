
-- ═══ ROLES ═══
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT NOT NULL DEFAULT 'Shield',
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active roles"
  ON public.roles FOR SELECT TO authenticated
  USING (is_active = true);

-- ═══ PERMISSIONS ═══
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL,
  category TEXT,
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view permissions"
  ON public.permissions FOR SELECT TO authenticated
  USING (true);

-- ═══ ROLE_PERMISSIONS (matrix) ═══
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON public.role_permissions(permission_id);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (true);

-- ═══ USER_ROLES ═══
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role_key TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_workspace ON public.user_roles(workspace_id);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if a user is workspace admin (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND role_key = 'workspace_admin'
  );
$$;

CREATE POLICY "Users can view roles in their workspaces"
  ON public.user_roles FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Workspace admins can assign roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Workspace admins can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Workspace admins can remove roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- ═══ SEED: 5 default roles ═══
INSERT INTO public.roles (key, name, description, level, color, icon, is_system) VALUES
  ('workspace_admin', 'Admin do Workspace', 'Acesso total a tudo no workspace', 100, '#ef4444', 'Crown', true),
  ('agent_editor', 'Editor de Agentes', 'Cria, edita e implanta agentes e workflows', 70, '#8b5cf6', 'Edit', true),
  ('operator', 'Operador', 'Executa agentes, consulta Oracle e monitora produção', 50, '#06b6d4', 'PlayCircle', true),
  ('auditor', 'Auditor', 'Acesso somente-leitura a logs, traces e compliance', 40, '#f59e0b', 'FileSearch', true),
  ('agent_viewer', 'Visualizador', 'Apenas visualiza agentes e dashboards', 30, '#10b981', 'Eye', true)
ON CONFLICT (key) DO NOTHING;

-- ═══ SEED: 40 permissions ═══
INSERT INTO public.permissions (key, name, description, module, category) VALUES
  -- Agents
  ('agents.create', 'Criar agentes', 'Pode criar novos agentes', 'agents', 'write'),
  ('agents.read', 'Ver agentes', 'Pode visualizar agentes', 'agents', 'read'),
  ('agents.update', 'Editar agentes', 'Pode modificar configuração de agentes', 'agents', 'write'),
  ('agents.delete', 'Excluir agentes', 'Pode remover agentes permanentemente', 'agents', 'destructive'),
  ('agents.deploy', 'Implantar agentes', 'Pode promover agentes a produção', 'agents', 'admin'),
  ('agents.test', 'Testar agentes', 'Pode executar testes em agentes', 'agents', 'execute'),
  -- Workflows
  ('workflows.create', 'Criar workflows', 'Pode criar novos workflows', 'workflows', 'write'),
  ('workflows.read', 'Ver workflows', 'Pode visualizar workflows', 'workflows', 'read'),
  ('workflows.update', 'Editar workflows', 'Pode modificar workflows', 'workflows', 'write'),
  ('workflows.delete', 'Excluir workflows', 'Pode remover workflows', 'workflows', 'destructive'),
  ('workflows.execute', 'Executar workflows', 'Pode rodar workflows', 'workflows', 'execute'),
  -- Knowledge
  ('knowledge.read', 'Ler bases de conhecimento', 'Pode ver knowledge bases', 'knowledge', 'read'),
  ('knowledge.write', 'Editar bases de conhecimento', 'Pode adicionar/remover documentos', 'knowledge', 'write'),
  ('knowledge.delete', 'Excluir bases', 'Pode remover knowledge bases', 'knowledge', 'destructive'),
  ('knowledge.manage', 'Gerenciar bases', 'Pode configurar embeddings e vetores', 'knowledge', 'admin'),
  -- Oracle
  ('oracle.query', 'Consultar Oracle', 'Pode fazer queries no Oracle', 'oracle', 'execute'),
  ('oracle.configure', 'Configurar Oracle', 'Pode editar presets e modelos', 'oracle', 'admin'),
  ('oracle.history', 'Ver histórico Oracle', 'Pode acessar histórico de queries', 'oracle', 'read'),
  ('oracle.write', 'Salvar presets', 'Pode criar e editar presets', 'oracle', 'write'),
  -- Datahub
  ('datahub.read', 'Ler Data Hub', 'Pode visualizar dados', 'datahub', 'read'),
  ('datahub.write', 'Editar Data Hub', 'Pode modificar conexões', 'datahub', 'write'),
  ('datahub.connections', 'Gerenciar conexões', 'Pode criar/remover conexões externas', 'datahub', 'admin'),
  -- Team
  ('team.read', 'Ver equipe', 'Pode ver membros do workspace', 'team', 'read'),
  ('team.invite', 'Convidar membros', 'Pode convidar novos usuários', 'team', 'write'),
  ('team.remove', 'Remover membros', 'Pode remover usuários do workspace', 'team', 'destructive'),
  ('team.roles', 'Atribuir funções', 'Pode mudar funções de membros', 'team', 'admin'),
  -- Settings
  ('settings.read', 'Ver configurações', 'Pode visualizar configurações', 'settings', 'read'),
  ('settings.write', 'Editar configurações', 'Pode modificar configurações gerais', 'settings', 'write'),
  ('settings.api_keys', 'Gerenciar API Keys', 'Pode criar/revogar API keys', 'settings', 'admin'),
  ('settings.billing', 'Gerenciar billing', 'Pode ver e modificar plano', 'settings', 'admin'),
  -- Monitoring
  ('monitoring.read', 'Ver monitoramento', 'Pode ver métricas e dashboards', 'monitoring', 'read'),
  ('monitoring.traces', 'Ver traces', 'Pode acessar traces detalhados', 'monitoring', 'read'),
  ('monitoring.audit', 'Ver audit log', 'Pode acessar log de auditoria', 'monitoring', 'admin'),
  -- Tools
  ('tools.read', 'Ver ferramentas', 'Pode visualizar ferramentas instaladas', 'tools', 'read'),
  ('tools.write', 'Gerenciar ferramentas', 'Pode instalar/remover ferramentas', 'tools', 'write'),
  -- Integrations
  ('integrations.read', 'Ver integrações', 'Pode visualizar integrações', 'integrations', 'read'),
  ('integrations.write', 'Gerenciar integrações', 'Pode configurar integrações', 'integrations', 'write')
ON CONFLICT (key) DO NOTHING;

-- ═══ SEED: role_permissions matrix ═══
-- workspace_admin: ALL permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'workspace_admin'
ON CONFLICT DO NOTHING;

-- agent_editor: agents.*, workflows.*, knowledge.read/write, oracle.*, monitoring.read, tools.*
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'agent_editor'
  AND (p.module IN ('agents', 'workflows', 'oracle', 'tools')
       OR p.key IN ('knowledge.read', 'knowledge.write', 'monitoring.read', 'monitoring.traces', 'integrations.read', 'datahub.read'))
ON CONFLICT DO NOTHING;

-- operator: agents.read/test, workflows.read/execute, oracle.query/history, knowledge.read, monitoring.read
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'operator'
  AND p.key IN ('agents.read', 'agents.test', 'workflows.read', 'workflows.execute',
                'oracle.query', 'oracle.history', 'knowledge.read', 'monitoring.read',
                'tools.read', 'datahub.read', 'integrations.read', 'team.read')
ON CONFLICT DO NOTHING;

-- auditor: read-only on monitoring, audit, agents, workflows, knowledge
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'auditor'
  AND (p.category = 'read' OR p.key IN ('monitoring.audit', 'monitoring.traces'))
ON CONFLICT DO NOTHING;

-- agent_viewer: read-only on agents, workflows, knowledge, monitoring
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'agent_viewer'
  AND p.key IN ('agents.read', 'workflows.read', 'knowledge.read', 'monitoring.read', 'team.read')
ON CONFLICT DO NOTHING;

-- ═══ TRIGGER: updated_at on roles ═══
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
