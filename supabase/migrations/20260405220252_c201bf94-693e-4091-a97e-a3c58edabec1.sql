-- Fix 1: tool_policies - restrict null agent_id to workspace context
DROP POLICY IF EXISTS "tool_policies_all" ON public.tool_policies;

CREATE POLICY "tool_policies_agent_owner"
ON public.tool_policies
FOR ALL
TO authenticated
USING (
  agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
)
WITH CHECK (
  agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
);

-- Fix 2: Make session_traces and trace_events immutable (no DELETE)
DROP POLICY IF EXISTS "session_traces_all" ON public.session_traces;

CREATE POLICY "session_traces_select"
ON public.session_traces
FOR SELECT
TO authenticated
USING (
  session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
);

CREATE POLICY "session_traces_insert"
ON public.session_traces
FOR INSERT
TO authenticated
WITH CHECK (
  session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "trace_events_all" ON public.trace_events;

CREATE POLICY "trace_events_select"
ON public.trace_events
FOR SELECT
TO authenticated
USING (
  session_trace_id IN (
    SELECT st.id FROM session_traces st
    JOIN sessions s ON st.session_id = s.id
    WHERE s.user_id = auth.uid()
  )
);

CREATE POLICY "trace_events_insert"
ON public.trace_events
FOR INSERT
TO authenticated
WITH CHECK (
  session_trace_id IN (
    SELECT st.id FROM session_traces st
    JOIN sessions s ON st.session_id = s.id
    WHERE s.user_id = auth.uid()
  )
);