-- 1. Audit log: block direct INSERT/UPDATE/DELETE (use RPC log_audit_entry only)
CREATE POLICY "Block direct insert on audit_log"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "Block update on audit_log"
ON public.audit_log FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "Block delete on audit_log"
ON public.audit_log FOR DELETE TO authenticated
USING (false);

-- 2. Tool policies: allow workspace members (not just agent owner) to manage
DROP POLICY IF EXISTS "Users can manage tool policies for their agents" ON public.tool_policies;

CREATE POLICY "Users can manage tool policies for their agents"
ON public.tool_policies FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = tool_policies.agent_id
    AND (
      a.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = a.workspace_id
        AND wm.user_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = tool_policies.agent_id
    AND (
      a.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = a.workspace_id
        AND wm.user_id = auth.uid()
      )
    )
  )
);