
-- workspace_secrets table for API keys
CREATE TABLE IF NOT EXISTS public.workspace_secrets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL,
  key_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, key_name)
);

ALTER TABLE public.workspace_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace secrets" ON public.workspace_secrets
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can insert workspace secrets" ON public.workspace_secrets
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (
    SELECT ws.id FROM public.workspaces ws WHERE ws.owner_id = auth.uid()
  ));

CREATE POLICY "Admins can update workspace secrets" ON public.workspace_secrets
  FOR UPDATE TO authenticated
  USING (workspace_id IN (
    SELECT ws.id FROM public.workspaces ws WHERE ws.owner_id = auth.uid()
  ));

CREATE POLICY "Admins can delete workspace secrets" ON public.workspace_secrets
  FOR DELETE TO authenticated
  USING (workspace_id IN (
    SELECT ws.id FROM public.workspaces ws WHERE ws.owner_id = auth.uid()
  ));
