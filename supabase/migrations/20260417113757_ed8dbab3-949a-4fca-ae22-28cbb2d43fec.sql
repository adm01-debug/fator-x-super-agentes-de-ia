-- Revoga acesso direto à coluna email; uso deve ser via view workspace_members_safe
REVOKE SELECT (email) ON public.workspace_members FROM authenticated;
REVOKE SELECT (email) ON public.workspace_members FROM anon;

-- Garante que outras colunas continuam acessíveis (RLS continua mediando linhas)
GRANT SELECT (id, workspace_id, user_id, role, name, invited_at, accepted_at)
  ON public.workspace_members TO authenticated;