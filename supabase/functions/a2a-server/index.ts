/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — A2A Server (Agent-to-Agent Protocol)
 * ═══════════════════════════════════════════════════════════════
 * Implements Google A2A Protocol v0.3 for inter-agent communication.
 * External agents can discover Nexus agents via Agent Cards and
 * send Tasks that are routed to the correct Nexus agent.
 *
 * Endpoints:
 *   GET  /.well-known/agent.json  → Agent Card (discovery)
 *   POST /tasks/send              → Send task to agent
 *   GET  /tasks/:id               → Get task status
 *
 * Reference: google/A2A, A2A v0.3 spec
 * ═══════════════════════════════════════════════════════════════
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  handleCorsPreflight, jsonResponse, errorResponse, getCorsHeaders,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
} from "../_shared/mod.ts";

// ═══ A2A Types ═══
interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
  };
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    examples?: string[];
  }>;
  authentication?: {
    schemes: string[];
  };
}

interface A2ATask {
  id: string;
  status: 'submitted' | 'working' | 'input-required' | 'completed' | 'failed' | 'canceled';
  message: {
    role: 'user' | 'agent';
    parts: Array<{ type: 'text'; text: string } | { type: 'data'; data: Record<string, unknown> }>;
  };
  artifacts?: Array<{
    name: string;
    parts: Array<{ type: 'text'; text: string }>;
  }>;
  history?: Array<{
    role: string;
    parts: Array<{ type: string; text?: string }>;
  }>;
}

// ═══ Agent Card Generator ═══
async function getAgentCard(supabaseUrl: string, supabaseKey: string, agentId?: string): Promise<AgentCard> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (agentId) {
    const { data: agent } = await supabase.from('agents').select('*').eq('id', agentId).single();
    if (agent) {
      const config = (agent.config || {}) as Record<string, unknown>;
      return {
        name: String(agent.name),
        description: String(agent.mission || `Nexus Agent: ${agent.name}`),
        url: `${supabaseUrl}/functions/v1/a2a-server`,
        version: '1.0.0',
        capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: true },
        skills: [{
          id: String(agent.id),
          name: String(agent.name),
          description: String(agent.mission || ''),
          tags: Array.isArray(agent.tags) ? agent.tags as string[] : [],
          examples: (config.few_shot_examples as Array<Record<string, string>> || []).map(e => e.input).slice(0, 3),
        }],
        authentication: { schemes: ['bearer'] },
      };
    }
  }

  // Default: platform-level Agent Card
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, mission, tags')
    .eq('status', 'production')
    .limit(20);

  return {
    name: 'Nexus Agents Studio',
    description: 'Plataforma operacional de agentes IA da Promo Brindes. Oráculo (Multi-LLM Council), Super Cérebro (Enterprise Memory), DataHub (Cross-Database Intelligence).',
    url: `${supabaseUrl}/functions/v1/a2a-server`,
    version: '1.0.0',
    capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: true },
    skills: (agents || []).map((a: Record<string, unknown>) => ({
      id: String(a.id),
      name: String(a.name),
      description: String(a.mission || ''),
      tags: Array.isArray(a.tags) ? a.tags as string[] : [],
    })),
    authentication: { schemes: ['bearer'] },
  };
}

// ═══ Task Processing ═══
async function processTask(
  task: { message: string; agentId?: string; sessionId?: string },
  supabaseUrl: string,
  supabaseKey: string,
  authHeader: string,
): Promise<A2ATask> {
  const taskId = crypto.randomUUID();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  try {
    // Route to agent via smolagent-runtime or llm-gateway
    const endpoint = task.agentId
      ? `${supabaseUrl}/functions/v1/smolagent-runtime`
      : `${supabaseUrl}/functions/v1/llm-gateway`;

    const body = task.agentId
      ? { action: 'run', task: task.message, agent_id: task.agentId }
      : {
          model: 'claude-sonnet-4-6',
          messages: [{ role: 'user', content: task.message }],
          temperature: 0.7,
          max_tokens: 4096,
        };

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'apikey': anonKey,
      },
      body: JSON.stringify(body),
    });

    const result = await resp.json();
    const responseText = task.agentId
      ? String((result as Record<string, unknown>).final_answer || (result as Record<string, unknown>).result || JSON.stringify(result))
      : String((result as Record<string, unknown>).content || JSON.stringify(result));

    return {
      id: taskId,
      status: 'completed',
      message: { role: 'user', parts: [{ type: 'text', text: task.message }] },
      artifacts: [{
        name: 'response',
        parts: [{ type: 'text', text: responseText }],
      }],
    };
  } catch (err) {
    return {
      id: taskId,
      status: 'failed',
      message: { role: 'user', parts: [{ type: 'text', text: task.message }] },
      artifacts: [{
        name: 'error',
        parts: [{ type: 'text', text: err instanceof Error ? err.message : 'Task processing failed' }],
      }],
    };
  }
}

// ═══ HTTP Server ═══
serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/a2a-server\/?/, '/').replace(/\/+$/, '') || '/';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Rate limiting
  const identifier = getRateLimitIdentifier(req);
  const rateCheck = checkRateLimit(identifier, RATE_LIMITS.standard);
  if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

  try {
    // ═══ Agent Card Discovery ═══
    if (req.method === 'GET' && (path === '/.well-known/agent.json' || path === '/agent.json' || path === '/')) {
      const agentId = url.searchParams.get('agent_id') || undefined;
      const card = await getAgentCard(supabaseUrl, supabaseKey, agentId);
      return jsonResponse(req, card);
    }

    // ═══ Send Task ═══
    if (req.method === 'POST' && (path === '/tasks/send' || path === '/tasks')) {
      const body = await req.json() as Record<string, unknown>;
      const message = body.message as Record<string, unknown>;
      const textPart = (message?.parts as Array<Record<string, string>>)?.find(p => p.type === 'text');

      if (!textPart?.text) {
        return errorResponse(req, 'Message with text part required', 400);
      }

      const authHeader = req.headers.get('Authorization') || `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`;
      const result = await processTask(
        {
          message: textPart.text,
          agentId: body.skill_id as string || body.agent_id as string || undefined,
          sessionId: body.session_id as string || undefined,
        },
        supabaseUrl,
        supabaseKey,
        authHeader,
      );

      return jsonResponse(req, { id: result.id, result });
    }

    return errorResponse(req, 'Not found. Available: GET /agent.json, POST /tasks/send', 404);

  } catch (error) {
    return errorResponse(req, error instanceof Error ? error.message : 'Internal error', 500);
  }
});
