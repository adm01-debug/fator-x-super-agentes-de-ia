-- Atomic save: agent config + trace in single transaction
CREATE OR REPLACE FUNCTION public.save_agent_atomic(
  p_agent_id UUID,
  p_user_id UUID,
  p_name TEXT,
  p_config JSONB,
  p_version_lock INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_current_lock INTEGER;
BEGIN
  -- Check optimistic lock if provided
  IF p_version_lock IS NOT NULL THEN
    SELECT version_lock INTO v_current_lock FROM public.agents WHERE id = p_agent_id;
    IF v_current_lock IS NOT NULL AND v_current_lock != p_version_lock THEN
      RAISE EXCEPTION 'Concurrent modification detected. Expected version %, got %', p_version_lock, v_current_lock;
    END IF;
  END IF;

  -- Upsert agent
  INSERT INTO public.agents (id, user_id, name, config, version_lock)
  VALUES (p_agent_id, p_user_id, p_name, p_config, COALESCE(p_version_lock, 0) + 1)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    config = EXCLUDED.config,
    version_lock = COALESCE(public.agents.version_lock, 0) + 1,
    updated_at = NOW();

  v_result := jsonb_build_object(
    'id', p_agent_id,
    'version_lock', COALESCE(p_version_lock, 0) + 1,
    'updated_at', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
