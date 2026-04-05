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
  pattern: string;        // The learned strategy
  success_count: number;
  failure_count: number;
  confidence: number;     // 0-1 based on success ratio
  source_trace_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ReflectionResult {
  lessons_learned: string[];
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
  return (data ?? []) as unknown as AgentSkill[];
}

// Record a skill learned from experience
export async function learnSkill(
  agentId: string,
  skillName: string,
  description: string,
  pattern: string,
  traceId?: string
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
      source_trace_id: traceId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agent_id,skill_name' })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as AgentSkill;
}

// Update skill confidence after execution
export async function updateSkillOutcome(
  skillId: string,
  success: boolean
): Promise<void> {
  const column = success ? 'success_count' : 'failure_count';
  const { error } = await supabase.rpc('increment_skill_counter', {
    p_skill_id: skillId,
    p_column: column,
  });
  if (error) {
    // Fallback: direct update
    const { data: skill } = await supabase.from('agent_skills').select('*').eq('id', skillId).single();
    if (skill) {
      const s = skill as unknown as AgentSkill;
      const newSuccess = s.success_count + (success ? 1 : 0);
      const newFailure = s.failure_count + (success ? 0 : 1);
      const confidence = newSuccess / (newSuccess + newFailure);
      await supabase.from('agent_skills').update({
        success_count: newSuccess,
        failure_count: newFailure,
        confidence,
        updated_at: new Date().toISOString(),
      }).eq('id', skillId);
    }
  }
}

// Reflect on traces and extract skills (Reflector)
export async function reflectOnTraces(
  agentId: string,
  recentTraces: Array<{ input: string; output: string; success: boolean; tools_used: string[] }>
): Promise<ReflectionResult> {
  const successes = recentTraces.filter(t => t.success);
  const failures = recentTraces.filter(t => !t.success);

  const lessons: string[] = [];
  const skills: AgentSkill[] = [];
  const improvements: string[] = [];
  const failurePatterns: string[] = [];

  // Extract success patterns
  if (successes.length > 0) {
    const toolFrequency = new Map<string, number>();
    successes.forEach(t => t.tools_used.forEach(tool => {
      toolFrequency.set(tool, (toolFrequency.get(tool) || 0) + 1);
    }));

    for (const [tool, count] of toolFrequency) {
      if (count >= 2) {
        lessons.push(`Tool "${tool}" foi eficaz em ${count} de ${successes.length} casos de sucesso`);
      }
    }
  }

  // Extract failure patterns
  if (failures.length > 0) {
    const errorPatterns = new Map<string, number>();
    failures.forEach(t => {
      const pattern = t.output.substring(0, 100);
      errorPatterns.set(pattern, (errorPatterns.get(pattern) || 0) + 1);
    });

    for (const [pattern, count] of errorPatterns) {
      if (count >= 2) {
        failurePatterns.push(`Padrão de falha recorrente (${count}x): "${pattern.substring(0, 80)}..."`);
        improvements.push(`Considerar estratégia alternativa para evitar: "${pattern.substring(0, 50)}..."`);
      }
    }
  }

  return { lessons_learned: lessons, skills_discovered: skills, improvements_suggested: improvements, failure_patterns: failurePatterns };
}

// Generate system prompt injection with learned skills
export function buildSkillbookPrompt(skills: AgentSkill[]): string {
  if (skills.length === 0) return '';

  const highConfidence = skills.filter(s => s.confidence >= 0.7);
  if (highConfidence.length === 0) return '';

  const skillsList = highConfidence
    .slice(0, 10)
    .map(s => `- ${s.skill_name} (confiança: ${Math.round(s.confidence * 100)}%): ${s.pattern}`)
    .join('\n');

  return `\n\n<learned_skills>\nEstratégias aprendidas com experiências anteriores:\n${skillsList}\nUse estas estratégias quando relevante para a tarefa atual.\n</learned_skills>`;
}
