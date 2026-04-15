/**
 * Nexus Agents Studio — OpenClaw Deploy Service
 * Wires the `openclaw-proxy` Edge Function to the UI.
 *
 * OpenClaw is the SKILL.md runtime that lives on the Hostinger VPS
 * (187.77.151.129). The proxy EF is the only entry point — never call
 * OpenClaw directly from the browser, always go through openclaw-proxy
 * so the API token stays server-side.
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { logger } from '@/lib/logger';

export type OpenclawAction =
  | 'health'
  | 'chat'
  | 'agents'
  | 'agent.create'
  | 'agent.update'
  | 'agent.delete'
  | 'skills'
  | 'skill.deploy';

export interface OpenclawInvokeInput {
  action: OpenclawAction;
  payload?: Record<string, unknown>;
}

export interface OpenclawAgent {
  id: string;
  name: string;
  description?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface OpenclawSkill {
  id: string;
  name: string;
  version?: string;
  description?: string;
  [key: string]: unknown;
}

export interface OpenclawHealthResult {
  status: string;
  uptime?: number;
  version?: string;
  [key: string]: unknown;
}

export interface OpenclawInvokeResult<T = unknown> {
  ok?: boolean;
  data?: T;
  error?: string;
  status?: number;
}

/**
 * Generic OpenClaw proxy invocation. Prefer the typed helpers below.
 */
export async function invokeOpenclaw<T = unknown>(
  input: OpenclawInvokeInput
): Promise<OpenclawInvokeResult<T>> {
  if (!input.action) throw new Error('OpenClaw action is required');

  const { data, error } = await supabaseExternal.functions.invoke('openclaw-proxy', {
    body: {
      action: input.action,
      payload: input.payload ?? {},
    },
  });

  if (error) {
    logger.error('openclaw-proxy invoke failed', {
      action: input.action,
      error: error.message,
    });
    throw new Error(error.message);
  }

  return (data as OpenclawInvokeResult<T>) ?? { ok: true };
}

/** Pings OpenClaw and returns its health status. */
export async function getOpenclawHealth(): Promise<OpenclawHealthResult> {
  const result = await invokeOpenclaw<OpenclawHealthResult>({ action: 'health' });
  return (result.data as OpenclawHealthResult) ?? { status: 'unknown' };
}

/** Lists agents currently deployed on OpenClaw. */
export async function listOpenclawAgents(): Promise<OpenclawAgent[]> {
  const result = await invokeOpenclaw<{ agents?: OpenclawAgent[] } | OpenclawAgent[]>({
    action: 'agents',
  });
  const data = result.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { agents?: OpenclawAgent[] }).agents)) {
    return (data as { agents: OpenclawAgent[] }).agents;
  }
  return [];
}

/** Lists SKILL.md packages installed on OpenClaw. */
export async function listOpenclawSkills(): Promise<OpenclawSkill[]> {
  const result = await invokeOpenclaw<{ skills?: OpenclawSkill[] } | OpenclawSkill[]>({
    action: 'skills',
  });
  const data = result.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { skills?: OpenclawSkill[] }).skills)) {
    return (data as { skills: OpenclawSkill[] }).skills;
  }
  return [];
}

/** Deploys a SKILL.md package to OpenClaw. */
export async function deploySkillToOpenclaw(skill: {
  name: string;
  content: string;
  version?: string;
  description?: string;
}): Promise<OpenclawInvokeResult> {
  return invokeOpenclaw({
    action: 'skill.deploy',
    payload: skill,
  });
}

/** Sends a chat message through the OpenClaw runtime. */
export async function chatWithOpenclawAgent(
  agentId: string,
  message: string,
  context: Record<string, unknown> = {}
): Promise<OpenclawInvokeResult<{ reply: string }>> {
  return invokeOpenclaw<{ reply: string }>({
    action: 'chat',
    payload: { agent_id: agentId, message, context },
  });
}
