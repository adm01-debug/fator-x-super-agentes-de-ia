/**
 * restorePresetsService — CRUD de presets de campos para o diálogo de
 * rollback. Cada preset é uma combinação nomeada de copyPrompt / copyTools /
 * copyModel que o usuário pode reaplicar com um clique.
 *
 * Persistência via tabela `restore_field_presets` (RLS por usuário).
 */
import { supabase } from '@/integrations/supabase/client';

export interface RestorePreset {
  id: string;
  user_id: string;
  name: string;
  copy_prompt: boolean;
  copy_tools: boolean;
  copy_model: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RestorePresetInput {
  name: string;
  copy_prompt: boolean;
  copy_tools: boolean;
  copy_model: boolean;
  is_default?: boolean;
}

/** Lista presets do usuário corrente — default primeiro, depois mais recentes. */
export async function listRestorePresets(): Promise<RestorePreset[]> {
  const { data, error } = await supabase
    .from('restore_field_presets')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RestorePreset[];
}

/**
 * Cria preset. Se `is_default=true`, primeiro desmarca o default existente
 * (a UNIQUE INDEX parcial bloquearia a inserção caso contrário).
 */
export async function createRestorePreset(input: RestorePresetInput): Promise<RestorePreset> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar autenticado.');

  if (input.is_default) {
    await supabase
      .from('restore_field_presets')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('restore_field_presets')
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      copy_prompt: input.copy_prompt,
      copy_tools: input.copy_tools,
      copy_model: input.copy_model,
      is_default: input.is_default ?? false,
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Já existe um preset com esse nome.');
    throw error;
  }
  return data as RestorePreset;
}

/** Marca um preset como default (zera o anterior numa única transação lógica). */
export async function setDefaultRestorePreset(presetId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar autenticado.');

  // Limpa default anterior — RLS garante que só toca em linhas próprias.
  await supabase
    .from('restore_field_presets')
    .update({ is_default: false })
    .eq('user_id', user.id)
    .eq('is_default', true);

  const { error } = await supabase
    .from('restore_field_presets')
    .update({ is_default: true })
    .eq('id', presetId);
  if (error) throw error;
}

export async function deleteRestorePreset(presetId: string): Promise<void> {
  const { error } = await supabase
    .from('restore_field_presets')
    .delete()
    .eq('id', presetId);
  if (error) throw error;
}
