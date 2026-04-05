-- ═══════════════════════════════════════════════════════════════
-- Nexus Agents Studio — RBAC System
-- ETAPA 02: Roles, Permissions, Access Control
-- Pattern: Dify workspace RBAC + n8n enterprise permissions
-- ═══════════════════════════════════════════════════════════════

-- ═══ Roles ═══
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,           -- 'workspace_admin', 'agent_editor', etc.
  name TEXT NOT NULL,                 -- 'Administrador do Workspace'
  description TEXT,
  level INTEGER NOT NULL DEFAULT 0,   -- Higher = more permissions (admin=100, viewer=10)
  color TEXT DEFAULT '#4D96FF',
  icon TEXT DEFAULT '👤',
  is_system BOOLEAN DEFAULT false,    -- System roles can't be deleted
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ Permissions ═══
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,           -- 'agents.create', 'agents.delete', etc.
  name TEXT NOT NULL,                 -- 'Criar Agentes'
  description TEXT,
  module TEXT NOT NULL,               -- 'agents', 'workflows', 'oracle', etc.
  category TEXT,                      -- 'crud', 'admin', 'view', etc.
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ Role-Permission mapping ═══
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- ═══ User-Role mapping (per workspace) ═══
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL REFERENCES public.roles(key),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, workspace_id)       -- One role per user per workspace
);

-- ═══ Agent-level permissions ═══
CREATE TABLE IF NOT EXISTS public.agent_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level TEXT NOT NULL DEFAULT 'view',  -- 'view', 'edit', 'deploy', 'admin'
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, user_id)
);

-- ═══ Indexes ═══
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_workspace ON public.user_roles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_agent_permissions_agent ON public.agent_permissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_permissions_user ON public.agent_permissions(user_id);

-- ═══ RLS ═══
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_permissions ENABLE ROW LEVEL SECURITY;

-- Roles & permissions are readable by all authenticated users
CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read permissions" ON public.permissions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read role_permissions" ON public.role_permissions
  FOR SELECT USING (auth.role() = 'authenticated');

-- User roles visible within same workspace
CREATE POLICY "Users can read roles in own workspace" ON public.user_roles
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Only workspace admins can manage user roles
CREATE POLICY "Admins can manage user roles" ON public.user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_key = r.key
      WHERE ur.user_id = auth.uid()
        AND ur.workspace_id = user_roles.workspace_id
        AND r.level >= 100
    )
  );

-- Agent permissions
CREATE POLICY "Users can read own agent permissions" ON public.agent_permissions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role manages all" ON public.roles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages permissions" ON public.permissions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages role_permissions" ON public.role_permissions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages agent_permissions" ON public.agent_permissions FOR ALL USING (auth.role() = 'service_role');

-- ═══ Seed: Default Roles ═══
INSERT INTO public.roles (key, name, description, level, icon, is_system) VALUES
  ('workspace_admin', 'Administrador', 'Acesso total ao workspace. Gerencia membros, roles, configurações e todos os agentes.', 100, '👑', true),
  ('agent_editor', 'Editor de Agentes', 'Pode criar, editar e testar agentes. Não pode gerenciar membros ou configurações do workspace.', 70, '✏️', true),
  ('agent_viewer', 'Visualizador', 'Pode visualizar agentes, dashboards e relatórios. Não pode editar ou criar.', 30, '👁️', true),
  ('operator', 'Operador', 'Pode executar agentes em produção e ver métricas. Não pode editar configurações.', 50, '⚙️', true),
  ('auditor', 'Auditor', 'Acesso somente leitura a logs, traces e auditoria. Focado em compliance.', 40, '🔍', true)
ON CONFLICT (key) DO NOTHING;

-- ═══ Seed: Default Permissions ═══
INSERT INTO public.permissions (key, name, module, category, is_system) VALUES
  -- Agents
  ('agents.create', 'Criar Agentes', 'agents', 'crud', true),
  ('agents.read', 'Visualizar Agentes', 'agents', 'crud', true),
  ('agents.update', 'Editar Agentes', 'agents', 'crud', true),
  ('agents.delete', 'Deletar Agentes', 'agents', 'crud', true),
  ('agents.deploy', 'Deploy de Agentes', 'agents', 'action', true),
  ('agents.test', 'Testar Agentes', 'agents', 'action', true),
  -- Workflows
  ('workflows.create', 'Criar Workflows', 'workflows', 'crud', true),
  ('workflows.read', 'Visualizar Workflows', 'workflows', 'crud', true),
  ('workflows.update', 'Editar Workflows', 'workflows', 'crud', true),
  ('workflows.delete', 'Deletar Workflows', 'workflows', 'crud', true),
  ('workflows.execute', 'Executar Workflows', 'workflows', 'action', true),
  -- Knowledge / Super Cérebro
  ('knowledge.read', 'Consultar Conhecimento', 'knowledge', 'crud', true),
  ('knowledge.write', 'Adicionar Conhecimento', 'knowledge', 'crud', true),
  ('knowledge.delete', 'Remover Conhecimento', 'knowledge', 'crud', true),
  ('knowledge.manage', 'Gerenciar Coleções', 'knowledge', 'admin', true),
  -- Oracle
  ('oracle.query', 'Consultar Oráculo', 'oracle', 'action', true),
  ('oracle.configure', 'Configurar Oráculo', 'oracle', 'admin', true),
  ('oracle.history', 'Ver Histórico Oráculo', 'oracle', 'view', true),
  -- DataHub
  ('datahub.read', 'Consultar DataHub', 'datahub', 'crud', true),
  ('datahub.write', 'Alterar Dados no DataHub', 'datahub', 'crud', true),
  ('datahub.connections', 'Gerenciar Conexões', 'datahub', 'admin', true),
  -- Team
  ('team.read', 'Ver Membros', 'team', 'crud', true),
  ('team.invite', 'Convidar Membros', 'team', 'action', true),
  ('team.remove', 'Remover Membros', 'team', 'action', true),
  ('team.roles', 'Gerenciar Roles', 'team', 'admin', true),
  -- Settings
  ('settings.read', 'Ver Configurações', 'settings', 'crud', true),
  ('settings.write', 'Alterar Configurações', 'settings', 'crud', true),
  ('settings.api_keys', 'Gerenciar API Keys', 'settings', 'admin', true),
  ('settings.billing', 'Ver Billing & Custos', 'settings', 'view', true),
  -- Monitoring
  ('monitoring.read', 'Ver Monitoramento', 'monitoring', 'view', true),
  ('monitoring.traces', 'Ver Traces Detalhados', 'monitoring', 'view', true),
  ('monitoring.audit', 'Ver Logs de Auditoria', 'monitoring', 'view', true)
ON CONFLICT (key) DO NOTHING;

-- ═══ Seed: Role-Permission Mappings ═══
-- Admin gets everything
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'workspace_admin'
ON CONFLICT DO NOTHING;

-- Editor gets agents + workflows + knowledge + oracle + datahub read + monitoring
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'agent_editor' AND (
  p.module IN ('agents', 'workflows', 'knowledge', 'oracle') OR
  (p.module = 'datahub' AND p.key = 'datahub.read') OR
  (p.module = 'monitoring' AND p.key = 'monitoring.read')
)
ON CONFLICT DO NOTHING;

-- Viewer gets read-only
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'agent_viewer' AND p.category IN ('view', 'crud') AND p.key LIKE '%.read'
ON CONFLICT DO NOTHING;

-- Operator gets execute + read + monitoring
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'operator' AND (
  p.key LIKE '%.read' OR
  p.key IN ('agents.test', 'agents.deploy', 'workflows.execute', 'oracle.query', 'datahub.read', 'monitoring.read', 'monitoring.traces')
)
ON CONFLICT DO NOTHING;

-- Auditor gets monitoring + audit
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'auditor' AND (
  p.key LIKE '%.read' OR
  p.module = 'monitoring'
)
ON CONFLICT DO NOTHING;

-- ═══ Helper Function: Check user permission ═══
CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id UUID,
  p_workspace_id UUID,
  p_permission_key TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = (SELECT id FROM public.roles WHERE key = ur.role_key)
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND ur.workspace_id = p_workspace_id
      AND p.key = p_permission_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ Auto-assign admin role to workspace creator ═══
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
RETURNS TRIGGER AS $$
BEGIN
  -- When a workspace member is created, if they're the first member, assign admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE workspace_id = NEW.workspace_id AND role_key = 'workspace_admin'
  ) THEN
    INSERT INTO public.user_roles (user_id, role_key, workspace_id, assigned_by)
    VALUES (NEW.user_id, 'workspace_admin', NEW.workspace_id, NEW.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_auto_assign_admin
  AFTER INSERT ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_admin_role();
