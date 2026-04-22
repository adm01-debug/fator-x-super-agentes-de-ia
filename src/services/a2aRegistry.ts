/**
 * A2A Registry — `src/services/a2aRegistry.ts`
 *
 * Registry de discovery cards (Agent-to-Agent, Google/Microsoft 2025).
 * Um cliente externo consulta `listPublicCards()` para descobrir os
 * nossos agentes e negocia capabilities via `negotiateCapabilities()`.
 *
 * O registry usa as tabelas `agents` + `agent_versions` existentes —
 * apenas filtra por `is_public=true` e anexa os endpoints MCP/A2A
 * derivados do workspace slug.
 */
import { supabase } from '@/integrations/supabase/client';
import type { AgentConfig } from '@/types/agentTypes';
import {
  buildDiscoveryCard,
  buildMcpManifest,
  type A2ADiscoveryCard,
  type McpServerManifest,
} from '@/lib/mcpManifest';

export interface A2ANegotiationRequest {
  caller_agent_id: string;
  caller_vendor: string;
  desired_capabilities: string[]; // tool ids procurados
  desired_languages?: string[];
}

export interface A2ANegotiationResult {
  matched: boolean;
  target: A2ADiscoveryCard | null;
  provided_capabilities: string[];
  missing_capabilities: string[];
  requires_auth: boolean;
  endpoints: { mcp?: string; a2a?: string };
}

/**
 * Lista discovery cards dos agentes públicos no registry.
 * Passa pelo filtro `is_public` e pelo RLS do Supabase.
 */
export async function listPublicCards(workspaceId?: string): Promise<A2ADiscoveryCard[]> {
  let q = supabase
    .from('agents')
    .select('id, name, avatar_emoji, mission, tags, model, config')
    .eq('is_template', false);
  if (workspaceId) q = q.eq('workspace_id', workspaceId);
  const { data, error } = await q;
  if (error) return [];

  const cards: A2ADiscoveryCard[] = [];
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const cfg = (row.config as Partial<AgentConfig>) ?? {};
    const card = buildDiscoveryCard(
      {
        ...(cfg as AgentConfig),
        name: String(row.name),
        avatar_emoji: (row.avatar_emoji as string | null) ?? null,
        mission: (row.mission as string | null) ?? null,
        tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
        tools: cfg.tools ?? [],
      },
      {
        mcp: `/mcp/${row.id}`,
        a2a: `/a2a/${row.id}`,
      },
    );
    card.id = String(row.id);
    cards.push(card);
  }
  return cards;
}

/**
 * Negocia capabilities: dado um conjunto desejado, identifica o agente
 * do registry que melhor atende. Devolve o card + as caps que faltam.
 */
export async function negotiateCapabilities(
  request: A2ANegotiationRequest,
  workspaceId?: string,
): Promise<A2ANegotiationResult> {
  const cards = await listPublicCards(workspaceId);
  if (cards.length === 0) {
    return {
      matched: false,
      target: null,
      provided_capabilities: [],
      missing_capabilities: request.desired_capabilities,
      requires_auth: false,
      endpoints: {},
    };
  }

  const desired = new Set(request.desired_capabilities);
  const scored = cards.map((card) => {
    const provided = card.capabilities.filter((c) => desired.has(c));
    const coverage = desired.size > 0 ? provided.length / desired.size : 0;
    return { card, provided, coverage };
  });
  scored.sort((a, b) => b.coverage - a.coverage);

  const best = scored[0];
  const missing = Array.from(desired).filter((c) => !best.provided.includes(c));

  return {
    matched: best.coverage > 0,
    target: best.card,
    provided_capabilities: best.provided,
    missing_capabilities: missing,
    requires_auth: true,
    endpoints: {
      mcp: best.card.endpoint_mcp,
      a2a: best.card.endpoint_a2a,
    },
  };
}

export async function getAgentManifest(agentId: string): Promise<McpServerManifest | null> {
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, avatar_emoji, model, config, version')
    .eq('id', agentId)
    .maybeSingle();
  if (error || !data) return null;
  const cfg = ((data as { config?: AgentConfig }).config ?? {}) as AgentConfig;
  const agent: AgentConfig = {
    ...cfg,
    name: String((data as { name: string }).name),
    avatar_emoji: ((data as { avatar_emoji?: string | null }).avatar_emoji ??
      null) as unknown as AgentConfig['avatar_emoji'],
    model: (data as { model?: string }).model ?? cfg.model,
    version: (data as { version?: number }).version ?? cfg.version ?? 1,
  };
  return buildMcpManifest(agent);
}
