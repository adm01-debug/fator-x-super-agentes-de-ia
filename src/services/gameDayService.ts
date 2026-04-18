import { supabase } from '@/integrations/supabase/client';

export type GameDayScenario = 'provider_outage' | 'cost_spike' | 'db_slowdown' | 'auth_failure' | 'custom';
export type GameDayStatus = 'scheduled' | 'running' | 'completed' | 'aborted';
export type GameDayEventType = 'fault_injected' | 'detection' | 'mitigation' | 'resolution' | 'note';

export interface GameDay {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  scenario: GameDayScenario;
  status: GameDayStatus;
  scheduled_at: string;
  started_at: string | null;
  ended_at: string | null;
  facilitator_id: string;
  participants: string[];
  runbook_section: string | null;
  chaos_experiment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameDayEvent {
  id: string;
  game_day_id: string;
  event_type: GameDayEventType;
  actor_id: string;
  occurred_at: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface GameDayScorecard {
  id: string;
  game_day_id: string;
  mttr_seconds: number | null;
  mttd_seconds: number | null;
  runbook_followed: boolean;
  gaps_found: string[];
  score: number | null;
  retrospective_notes: string | null;
  created_at: string;
  created_by: string;
}

export const SCENARIO_LABELS: Record<GameDayScenario, string> = {
  provider_outage: 'Provider Outage',
  cost_spike: 'Cost Spike',
  db_slowdown: 'DB Slowdown',
  auth_failure: 'Auth Failure',
  custom: 'Custom',
};

export async function listGameDays(workspaceId: string): Promise<GameDay[]> {
  const { data, error } = await supabase
    .from('game_days')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('scheduled_at', { ascending: false });
  if (error) throw error;
  return (data || []) as GameDay[];
}

export async function getGameDay(id: string): Promise<GameDay | null> {
  const { data, error } = await supabase.from('game_days').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as GameDay | null;
}

export async function createGameDay(input: {
  workspace_id: string;
  title: string;
  description?: string;
  scenario: GameDayScenario;
  scheduled_at: string;
  participants?: string[];
  runbook_section?: string;
}): Promise<GameDay> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('not authenticated');
  const { data, error } = await supabase
    .from('game_days')
    .insert({
      workspace_id: input.workspace_id,
      title: input.title,
      description: input.description ?? null,
      scenario: input.scenario,
      scheduled_at: input.scheduled_at,
      facilitator_id: user.user.id,
      participants: input.participants ?? [],
      runbook_section: input.runbook_section ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as GameDay;
}

export async function deleteGameDay(id: string): Promise<void> {
  const { error } = await supabase.from('game_days').delete().eq('id', id);
  if (error) throw error;
}

export async function startGameDay(id: string, injectChaos: boolean): Promise<void> {
  const { error } = await supabase.rpc('start_game_day', { p_game_day_id: id, p_inject_chaos: injectChaos });
  if (error) throw error;
}

export async function recordEvent(
  gameDayId: string,
  type: GameDayEventType,
  description: string,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await supabase.rpc('record_game_day_event', {
    p_game_day_id: gameDayId,
    p_event_type: type,
    p_description: description,
    p_metadata: metadata,
  });
  if (error) throw error;
  return data as string;
}

export async function listEvents(gameDayId: string): Promise<GameDayEvent[]> {
  const { data, error } = await supabase
    .from('game_day_events')
    .select('*')
    .eq('game_day_id', gameDayId)
    .order('occurred_at', { ascending: true });
  if (error) throw error;
  return (data || []) as GameDayEvent[];
}

export async function completeGameDay(input: {
  game_day_id: string;
  runbook_followed: boolean;
  gaps_found: string[];
  score: number;
  retrospective: string;
}): Promise<{ scorecard_id: string; mttr_seconds: number | null; mttd_seconds: number | null }> {
  const { data, error } = await supabase.rpc('complete_game_day', {
    p_game_day_id: input.game_day_id,
    p_runbook_followed: input.runbook_followed,
    p_gaps_found: input.gaps_found,
    p_score: input.score,
    p_retrospective: input.retrospective,
  });
  if (error) throw error;
  return data as { scorecard_id: string; mttr_seconds: number | null; mttd_seconds: number | null };
}

export async function getScorecard(gameDayId: string): Promise<GameDayScorecard | null> {
  const { data, error } = await supabase
    .from('game_day_scorecards')
    .select('*')
    .eq('game_day_id', gameDayId)
    .maybeSingle();
  if (error) throw error;
  return data as GameDayScorecard | null;
}
