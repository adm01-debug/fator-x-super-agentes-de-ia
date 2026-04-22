/**
 * Voice Telephony — `src/services/voiceTelephony.ts`
 *
 * Interface para voice-agent + telefonia. Client-side declara a
 * intenção (outbound call, inbound webhook, call transcript) e o
 * edge `voice-session` / `voice-synthesize` (já no repo) implementa
 * o transport real via Twilio/Vonage.
 *
 * Agnóstico de provider — contratos padrão inspirados em Sierra,
 * Lindy Phone e Voiceflow Voice.
 */
import { supabase } from '@/integrations/supabase/client';

export type CallDirection = 'outbound' | 'inbound';
export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'busy'
  | 'no_answer'
  | 'failed';

export interface OutboundCallInput {
  agent_id: string;
  to_phone: string; // E.164, ex: +5511999999999
  from_phone?: string;
  script_vars?: Record<string, string>;
  recording?: boolean;
  max_duration_s?: number;
  workspace_id?: string;
}

export interface VoiceCall {
  id: string;
  provider_sid: string | null; // Twilio/Vonage call SID
  direction: CallDirection;
  from_phone: string;
  to_phone: string;
  status: CallStatus;
  agent_id: string;
  transcript: string | null;
  recording_url: string | null;
  duration_s: number | null;
  cost_usd: number | null;
  started_at: string | null;
  ended_at: string | null;
}

/**
 * Dispara outbound call via edge `voice-session`. O edge cria registro
 * em `voice_calls` e chama o provedor (Twilio/Vonage configurado no
 * workspace). Devolve o call id para polling de status.
 */
export async function startOutboundCall(input: OutboundCallInput): Promise<{ call_id: string }> {
  const { data, error } = await supabase.functions.invoke('voice-session', {
    body: {
      action: 'outbound',
      agent_id: input.agent_id,
      to_phone: input.to_phone,
      from_phone: input.from_phone,
      script_vars: input.script_vars ?? {},
      recording: input.recording ?? true,
      max_duration_s: input.max_duration_s ?? 600,
      workspace_id: input.workspace_id,
    },
  });
  if (error) throw error;
  return data as { call_id: string };
}

export async function getCallStatus(call_id: string): Promise<VoiceCall | null> {
  const { data, error } = await supabase
    .from('voice_calls' as never)
    .select('*')
    .eq('id', call_id)
    .maybeSingle();
  if (error) return null;
  return (data as unknown as VoiceCall) ?? null;
}

export async function listCalls(
  filter: { agent_id?: string; limit?: number } = {},
): Promise<VoiceCall[]> {
  let q = supabase
    .from('voice_calls' as never)
    .select('*')
    .order('started_at', { ascending: false });
  if (filter.agent_id) q = q.eq('agent_id', filter.agent_id);
  q = q.limit(filter.limit ?? 50);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as unknown as VoiceCall[];
}

// ─── KPIs típicos de voice agent (padrão Sierra/Decagon) ────

export interface VoiceKpis {
  contained_rate: number; // % calls resolvidos sem escalar pra humano
  avg_handle_time_s: number;
  csat_voz: number | null;
  escalation_rate: number;
  cost_per_call_usd: number;
}

export function computeVoiceKpis(calls: VoiceCall[]): VoiceKpis {
  if (calls.length === 0) {
    return {
      contained_rate: 0,
      avg_handle_time_s: 0,
      csat_voz: null,
      escalation_rate: 0,
      cost_per_call_usd: 0,
    };
  }
  const completed = calls.filter((c) => c.status === 'completed');
  const escalated = calls.filter((c) => (c.transcript ?? '').toLowerCase().includes('transferir'));
  const durations = completed.map((c) => c.duration_s ?? 0);
  const costs = calls.map((c) => c.cost_usd ?? 0);
  return {
    contained_rate: calls.length > 0 ? (completed.length - escalated.length) / calls.length : 0,
    avg_handle_time_s:
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    csat_voz: null,
    escalation_rate: calls.length > 0 ? escalated.length / calls.length : 0,
    cost_per_call_usd: calls.length > 0 ? costs.reduce((a, b) => a + b, 0) / calls.length : 0,
  };
}
