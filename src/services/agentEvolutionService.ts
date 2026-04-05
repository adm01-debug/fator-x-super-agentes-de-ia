/**
 * Agent Self-Evolution Service — Agents that learn from experience
 * Inspired by ACE (kayba-ai) and OpenViking self-evolution
 *
 * Loop: Agent → Environment → Trace → Reflector → SkillManager → Skillbook → Agent
 */

import { supabase } from '@/integrations/supabase/client';

export interface AgentSkill {
  id: string;
  agent_id: string;
  skill_name: string;
  description: string;
  pattern: string;
  success_count: number;
  failure_count: number;
  confidence: number;
  source_trace_id?: string;
  created_at: string;
  updated_at: string;
}

export interface EvolutionReport {
  agent_id: string;
  total_skills: number;
  avg_confidence: number;
  skills_discovered: AgentSkill[];
  improvements_suggested: string[];
  failure_patterns: string[];
}

// Get agent's learned skills (Skillbook)
export async function getSkillbook(agentId: string): Promise<AgentSkill[]> {
  const { data, error } = await supabase
    .from('agent_skills')
    .select('*')
    .eq('agent_id', agentId)
    .order('confidence', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AgentSkill[];
}

// Record a skill learned from experience
export async function learnSkill(
  agentId: string,
  skillName: string,
  description: string,
  pattern: string,
  _traceId?: string
): Promise<AgentSkill> {
  const { data, error } = await supabase
    .from('agent_skills')
    .upsert({
      agent_id: agentId,
      skill_name: skillName,
      description,
      pattern,
      success_count: 1,
      failure_count: 0,
      confidence: 0.6,
      source_trace_id: _traceId ?? null,
    }, { onConflict: 'agent_id,skill_name' })
    .select()
    .single();
  if (error) throw error;
  return data as AgentSkill;
}

// Update skill confidence after execution
export async function updateSkillOutcome(
  skillId: string,
  success: boolean
): Promise<void> {
  const { data: skill } = await supabase
    .from('agent_skills')
    .select('*')
    .eq('id', skillId)
    .single();

  if (skill) {
    const newSuccess = skill.success_count + (success ? 1 : 0);
    const newFailure = skill.failure_count + (success ? 0 : 1);
    const confidence = newSuccess / (newSuccess + newFailure);
    await supabase
      .from('agent_skills')
      .update({
        success_count: newSuccess,
        failure_count: newFailure,
        confidence,
      })
      .eq('id', skillId);
  }
}

// Self-reflection: analyze traces and generate evolution report
export async function reflectAndEvolve(agentId: string, windowHours = 24): Promise<EvolutionReport> {
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();

  const { data: traces } = await supabase
    .from('agent_traces')
    .select('*')
    .eq('agent_id', agentId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  const skills = await getSkillbook(agentId);

  const failurePatterns: string[] = [];
  const improvements: string[] = [];

  for (const t of traces ?? []) {
    if (t.level === 'error') {
      const event = typeof t.event === 'string' ? t.event : '';
      failurePatterns.push(`Error in ${event}: check logs`);
    }
  }

  if (skills.length === 0) {
    improvements.push('No skills learned yet — enable more detailed tracing');
  }
  const lowConf = skills.filter(s => s.confidence < 0.5);
  if (lowConf.length > 0) {
    improvements.push(`${lowConf.length} skills with low confidence — review training data`);
  }

  return {
    agent_id: agentId,
    total_skills: skills.length,
    avg_confidence: skills.length ? skills.reduce((s, sk) => s + sk.confidence, 0) / skills.length : 0,
    skills_discovered: skills,
    improvements_suggested: improvements,
    failure_patterns: failurePatterns,
  };
}

// Prune skills that have very low confidence
export async function pruneWeakSkills(agentId: string, minConfidence = 0.2): Promise<number> {
  const { data, error } = await supabase
    .from('agent_skills')
    .delete()
    .eq('agent_id', agentId)
    .lt('confidence', minConfidence)
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}
