
CREATE OR REPLACE FUNCTION public.get_pending_invites_for_email(_email text)
RETURNS TABLE (
  id uuid, workspace_id uuid, role text, name text, invited_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_email text;
BEGIN
  -- Só permite ler convites do PRÓPRIO email do usuário autenticado
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS NULL OR lower(v_user_email) <> lower(_email) THEN
    RAISE EXCEPTION 'forbidden: can only query own invites';
  END IF;
  RETURN QUERY
    SELECT m.id, m.workspace_id, m.role, m.name, m.invited_at
    FROM public.workspace_members m
    WHERE lower(m.email) = lower(_email)
      AND m.accepted_at IS NULL
      AND m.user_id IS NULL;
END $$;
GRANT EXECUTE ON FUNCTION public.get_pending_invites_for_email(text) TO authenticated;
