-- Fix 1: Remove tables from realtime publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'agents'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.agents;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'agent_traces'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.agent_traces;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'evaluation_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.evaluation_runs;
  END IF;
END $$;

-- Fix 2: Add UPDATE policy on oracle_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'oracle_history' AND policyname = 'Users can update own oracle history'
  ) THEN
    CREATE POLICY "Users can update own oracle history"
    ON public.oracle_history FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Fix 3: Harden workspace_members INSERT policy
DROP POLICY IF EXISTS "Owners can add workspace members" ON public.workspace_members;
CREATE POLICY "Owners can add workspace members"
ON public.workspace_members FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IN (
    SELECT ws.id FROM workspaces ws WHERE ws.owner_id = auth.uid()
  )
);