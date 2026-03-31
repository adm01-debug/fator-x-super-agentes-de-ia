
-- Backfill: create workspaces for existing users who don't have one
INSERT INTO public.workspaces (name, owner_id)
SELECT COALESCE(u.raw_user_meta_data->>'full_name', 'Meu Workspace'), u.id
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.owner_id = u.id);

-- Backfill: create workspace_members for owners
INSERT INTO public.workspace_members (workspace_id, user_id, role, email)
SELECT w.id, w.owner_id, 'admin', u.email
FROM public.workspaces w
JOIN auth.users u ON u.id = w.owner_id
WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = w.id AND wm.user_id = w.owner_id);

-- Backfill: update existing agents with workspace_id
UPDATE public.agents a SET workspace_id = w.id
FROM public.workspaces w
WHERE a.user_id = w.owner_id AND a.workspace_id IS NULL;
