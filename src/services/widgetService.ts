/**
 * Nexus Agents Studio — Widget Service
 * Wires the `widget-proxy` Edge Function to the UI.
 *
 * The widget-proxy EF serves an embeddable web chat widget script
 * (`<script src=".../widget-proxy/widget/{agent_id}.js">`) and exposes a
 * lightweight `/chat` endpoint the widget calls back into. Operators
 * use this service to generate embed snippets and to validate that the
 * widget endpoint is responding for a given agent.
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { logger } from '@/lib/logger';

const PROJECT_REF = 'tdprnylgyrogbbhgdoik';
const FUNCTIONS_BASE = `https://${PROJECT_REF}.functions.supabaseExternal.co/widget-proxy`;

export interface WidgetEmbedSnippet {
  scriptUrl: string;
  htmlSnippet: string;
  agentId: string;
}

export interface WidgetChatInput {
  agent_id: string;
  message: string;
  session_id?: string;
  context?: Record<string, unknown>;
}

export interface WidgetChatResult {
  ok?: boolean;
  reply?: string;
  session_id?: string;
  error?: string;
}

/**
 * Builds the embed snippet for a given agent. Pure helper — no network call.
 * Operators copy this snippet into their own website to expose the agent
 * as a floating chat bubble.
 */
export function buildWidgetEmbedSnippet(agentId: string): WidgetEmbedSnippet {
  const scriptUrl = `${FUNCTIONS_BASE}/widget/${agentId}.js`;
  const htmlSnippet = `<script src="${scriptUrl}" async></script>`;
  return { scriptUrl, htmlSnippet, agentId };
}

/**
 * Posts a chat message through the widget-proxy `/chat` endpoint.
 * Used by the DeploymentsPage "Test Widget" panel so operators can
 * confirm the agent is responding before publishing the snippet.
 */
export async function sendWidgetChatMessage(
  input: WidgetChatInput
): Promise<WidgetChatResult> {
  if (!input.agent_id || !input.message) {
    throw new Error('agent_id and message are required');
  }

  const { data, error } = await supabaseExternal.functions.invoke('widget-proxy', {
    body: {
      path: '/chat',
      agent_id: input.agent_id,
      message: input.message,
      session_id: input.session_id ?? `widget-test-${Date.now()}`,
      context: input.context ?? {},
    },
  });

  if (error) {
    logger.error('widget-proxy chat invoke failed', {
      agent_id: input.agent_id,
      error: error.message,
    });
    throw new Error(error.message);
  }

  return (data as WidgetChatResult) ?? { ok: true };
}

/**
 * Validates that the widget-proxy endpoint is reachable for the given
 * agent by issuing a HEAD-style sanity request. Returns true on 2xx.
 */
export async function checkWidgetEndpointAvailable(agentId: string): Promise<boolean> {
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/widget/${agentId}.js`, {
      method: 'GET',
      cache: 'no-store',
    });
    return res.ok;
  } catch (e) {
    logger.error('widget endpoint check failed', {
      agent_id: agentId,
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}
