/**
 * Agent Self-Evolution Service — Agents that learn from experience
 * Inspired by ACE (kayba-ai) and OpenViking self-evolution
 *
 * Loop: Agent → Environment → Trace → Reflector → SkillManager → Skillbook → Agent
 */

import { supabaseExternal } from '@/integrations/supabase/externalClient';

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
  const { data, error } = await supabaseExternal
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
  const { data, error } = await supabaseExternal
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
  const { data: skill } = await supabaseExternal
    .from('agent_skills')
    .select('*')
    .eq('id', skillId)
    .single();

  if (skill) {
    const newSuccess = skill.success_count + (success ? 1 : 0);
    const newFailure = skill.failure_count + (success ? 0 : 1);
    const confidence = newSuccess / (newSuccess + newFailure);
    await supabaseExternal
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

  const { data: traces } = await supabaseExternal
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

// Build a prompt section from the agent's skillbook
export function buildSkillbookPrompt(skills: AgentSkill[]): string {
  const highConf = skills.filter(s => s.confidence >= 0.5);
  if (highConf.length === 0) return '';
  const lines = highConf.map(s => `- ${s.skill_name}: ${s.pattern} (confidence: ${(s.confidence * 100).toFixed(0)}%)`);
  return `<learned_skills>\n${lines.join('\n')}\n</learned_skills>`;
}

// Reflect on execution traces to find patterns
export async function reflectOnTraces(
  _agentId: string,
  traces: Array<{ input: string; output: string; success: boolean; tools_used: string[] }>
): Promise<{ lessons_learned: string[]; failure_patterns: string[] }> {
  const lessons: string[] = [];
  const failures: string[] = [];

  const toolFreq: Record<string, number> = {};
  const toolFails: Record<string, number> = {};

  for (const t of traces) {
    for (const tool of t.tools_used) {
      toolFreq[tool] = (toolFreq[tool] ?? 0) + 1;
      if (!t.success) toolFails[tool] = (toolFails[tool] ?? 0) + 1;
    }
  }

  for (const [tool, count] of Object.entries(toolFreq)) {
    if (count >= 2) lessons.push(`Tool "${tool}" used ${count} times — consider as a core skill`);
  }
  for (const [tool, count] of Object.entries(toolFails)) {
    if (count >= 2) failures.push(`Tool "${tool}" failed ${count} times — investigate reliability`);
  }

  return { lessons_learned: lessons, failure_patterns: failures };
}

// Prune skills that have very low confidence
export async function pruneWeakSkills(agentId: string, minConfidence = 0.2): Promise<number> {
  const { data, error } = await supabaseExternal
    .from('agent_skills')
    .delete()
    .eq('agent_id', agentId)
    .lt('confidence', minConfidence)
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}
