-- Presets de campos para o diálogo de rollback/comparação de versões.
-- Cada usuário pode salvar combinações nomeadas de copyPrompt/copyTools/copyModel
-- e marcar uma como padrão para aplicar com um clique ao abrir o diálogo.

CREATE TABLE public.restore_field_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  copy_prompt BOOLEAN NOT NULL DEFAULT true,
  copy_tools BOOLEAN NOT NULL DEFAULT true,
  copy_model BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Garante nomes únicos por usuário para evitar duplicatas confusas na UI.
  CONSTRAINT restore_field_presets_user_name_unique UNIQUE (user_id, name),
  -- Pelo menos um campo deve estar marcado, senão o preset é inútil.
  CONSTRAINT restore_field_presets_at_least_one CHECK (copy_prompt OR copy_tools OR copy_model),
  CONSTRAINT restore_field_presets_name_len CHECK (char_length(name) BETWEEN 1 AND 60)
);

-- Índice para a query mais comum: listar presets do usuário ordenados.
CREATE INDEX idx_restore_field_presets_user ON public.restore_field_presets (user_id, created_at DESC);

-- Garante apenas UM default por usuário (parcial — só conta linhas com is_default=true).
CREATE UNIQUE INDEX idx_restore_field_presets_one_default
  ON public.restore_field_presets (user_id)
  WHERE is_default = true;

ALTER TABLE public.restore_field_presets ENABLE ROW LEVEL SECURITY;

-- RLS: cada usuário enxerga e manipula apenas seus próprios presets.
CREATE POLICY "Users view own restore presets"
  ON public.restore_field_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own restore presets"
  ON public.restore_field_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own restore presets"
  ON public.restore_field_presets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own restore presets"
  ON public.restore_field_presets FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger de updated_at usando função pública já existente no projeto.
CREATE TRIGGER trg_restore_field_presets_updated_at
  BEFORE UPDATE ON public.restore_field_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();