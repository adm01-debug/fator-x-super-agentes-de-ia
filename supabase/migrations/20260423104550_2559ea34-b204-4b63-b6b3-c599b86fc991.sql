CREATE TABLE public.user_filter_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope)
);

CREATE INDEX idx_user_filter_preferences_user_scope
  ON public.user_filter_preferences (user_id, scope);

ALTER TABLE public.user_filter_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own filter prefs"
  ON public.user_filter_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own filter prefs"
  ON public.user_filter_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own filter prefs"
  ON public.user_filter_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own filter prefs"
  ON public.user_filter_preferences FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_user_filter_preferences()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_user_filter_preferences
  BEFORE UPDATE ON public.user_filter_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_filter_preferences();