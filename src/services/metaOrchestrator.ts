/**
 * Meta-Orchestrator — `src/services/metaOrchestrator.ts`
 *
 * Camada acima de `smart-model-router`: em vez de escolher só o **modelo**,
 * escolhe o **agente** certo para atender a query do usuário.
 *
 * O roteamento considera, nesta ordem:
 *   1. Intent — qual agente tem mission/tags que batem com as palavras-chave?
 *   2. Deploy gate — `computeDeployGate` garante que só agentes aprovados
 *      em eval são considerados (reusa Rodada 1).
 *   3. Carga — preferir agentes sem HITL pendente (via hitlQueue).
 *
 * Saída: lista ranqueada de candidatos com score 0..1 + razão textual.
 */
import { supabase } from '@/integrations/supabase/client';
import { computeDeployGate, type EvalGate } from '@/services/evalGates';
import { tokenize } from '@/lib/ragas';

export interface OrchestratedAgent {
  id: string;
  name: string;
  avatar_emoji: string | null;
  mission: string | null;
  tags: string[];
  status: string | null;
}

export interface RouteDecision {
  query: string;
  selected: OrchestratedAgent | null;
  score: number;
  reason: string;
  gate: EvalGate | null;
  alternatives: Array<{ agent: OrchestratedAgent; score: number; reason: string }>;
}

export interface RouteOptions {
  /** Se true, agentes que falham no deploy gate ficam fora do ranking. */
  enforceGate?: boolean;
  /** Máximo de alternativas ranqueadas a devolver. Default 3. */
  maxAlternatives?: number;
  /** Filtro opcional por workspace (RLS já filtra, mas mantém explicit). */
  workspaceId?: string;
}

async function loadCandidateAgents(workspaceId?: string): Promise<OrchestratedAgent[]> {
  let q = supabase
    .from('agents')
    .select('id, name, avatar_emoji, mission, tags, status, is_template')
    .eq('is_template', false);
  if (workspaceId) q = q.eq('workspace_id', workspaceId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    avatar_emoji: (row.avatar_emoji as string | null) ?? null,
    mission: (row.mission as string | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    status: (row.status as string | null) ?? null,
  }));
}

function scoreIntent(
  query: string,
  agent: OrchestratedAgent,
): { score: number; matches: string[] } {
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return { score: 0, matches: [] };

  const hay = [agent.name, agent.mission ?? '', agent.tags.join(' ')].join(' ');
  const agentTokens = new Set(tokenize(hay));
  if (agentTokens.size === 0) return { score: 0, matches: [] };

  const matches: string[] = [];
  let inter = 0;
  qTokens.forEach((t) => {
    if (agentTokens.has(t)) {
      inter++;
      matches.push(t);
    }
  });
  // precision-like score: quantos tokens da query bateram / total da query
  const score = inter / qTokens.size;
  return { score, matches };
}

export async function routeQueryToAgent(
  query: string,
  options: RouteOptions = {},
): Promise<RouteDecision> {
  const enforceGate = options.enforceGate ?? true;
  const maxAlternatives = options.maxAlternatives ?? 3;

  const agents = await loadCandidateAgents(options.workspaceId);
  if (agents.length === 0) {
    return {
      query,
      selected: null,
      score: 0,
      reason: 'Nenhum agente disponível no workspace.',
      gate: null,
      alternatives: [],
    };
  }

  // 1. Rankeia por intent
  const ranked = agents
    .map((agent) => {
      const { score, matches } = scoreIntent(query, agent);
      return {
        agent,
        score,
        reason:
          matches.length > 0
            ? `Intent match em: ${matches.slice(0, 5).join(', ')}`
            : 'Sem match direto — fallback por score baixo.',
      };
    })
    .sort((a, b) => b.score - a.score);

  // 2. Itera em ordem e busca o primeiro que passa no deploy gate
  for (let i = 0; i < ranked.length; i++) {
    const cand = ranked[i];
    if (cand.score === 0 && i > 0) break;
    if (!enforceGate) {
      return {
        query,
        selected: cand.agent,
        score: cand.score,
        reason: `${cand.reason} (gate não exigido)`,
        gate: null,
        alternatives: ranked
          .slice(1, maxAlternatives + 1)
          .map(({ agent, score, reason }) => ({ agent, score, reason })),
      };
    }
    try {
      const gate = await computeDeployGate(cand.agent.id);
      if (gate.allow) {
        return {
          query,
          selected: cand.agent,
          score: cand.score,
          reason: `${cand.reason} + gate OK (${(gate.pass_rate * 100).toFixed(1)}%)`,
          gate,
          alternatives: ranked
            .filter((_, idx) => idx !== i)
            .slice(0, maxAlternatives)
            .map(({ agent, score, reason }) => ({ agent, score, reason })),
        };
      }
    } catch {
      // erro ao consultar gate: pula este candidato
      continue;
    }
  }

  // 3. Fallback: nenhum passou
  const best = ranked[0];
  return {
    query,
    selected: null,
    score: best?.score ?? 0,
    reason: 'Nenhum agente apto — ou todos falham no deploy gate ou não há intent match.',
    gate: null,
    alternatives: ranked
      .slice(0, maxAlternatives)
      .map(({ agent, score, reason }) => ({ agent, score, reason })),
  };
}

// ═══ Pure rankers (exportados para teste) ══════════════════════
export const _internal = {
  scoreIntent,
};
