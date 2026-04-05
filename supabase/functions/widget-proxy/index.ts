/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Widget Proxy
 * ═══════════════════════════════════════════════════════════════
 * API endpoint for the embeddable web chat widget.
 * <script src="https://nexus.app/widget/{agent_id}.js"></script>
 * Reference: Flowise embed widget, ChatBotKit, Vercel Chat SDK
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  handleCorsPreflight, jsonResponse, errorResponse, getCorsHeaders,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  validateApiKey,
} from "../_shared/mod.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/widget-proxy\/?/, '/');

  // Serve widget JS
  if (req.method === 'GET' && path.match(/^\/widget\/[\w-]+\.js$/)) {
    const agentId = path.match(/\/widget\/([\w-]+)\.js/)?.[1];
    const cors = getCorsHeaders(req);
    const widgetJs = `
(function(){
  var w=document.createElement('div');w.id='nexus-widget-${agentId}';
  w.innerHTML='<iframe src="${Deno.env.get('SUPABASE_URL')?.replace('/rest/v1','')}/?widget=${agentId}" style="position:fixed;bottom:20px;right:20px;width:400px;height:600px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.4);z-index:99999;display:none" id="nexus-chat-frame"></iframe><button onclick="var f=document.getElementById(\\'nexus-chat-frame\\');f.style.display=f.style.display===\\'none\\'?\\'block\\':\\'none\\'" style="position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:28px;background:linear-gradient(135deg,#4D96FF,#6BCB77);border:none;cursor:pointer;box-shadow:0 4px 16px rgba(77,150,255,0.4);z-index:100000;display:flex;align-items:center;justify-content:center;font-size:24px">💬</button>';
  document.body.appendChild(w);
})();`;
    return new Response(widgetJs, { headers: { ...cors, 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=3600' } });
  }

  // Chat API for widget
  if (req.method === 'POST' && path === '/chat') {
    const identifier = getRateLimitIdentifier(req);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.standard);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    try {
      const { message, agent_id, session_id } = await req.json() as Record<string, string>;
      if (!message || !agent_id) return errorResponse(req, 'message and agent_id required', 400);

      // Validate API key or allow anonymous widget access
      const apiKeyResult = await validateApiKey(req);

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      // Route to smolagent-runtime
      const resp = await fetch(`${supabaseUrl}/functions/v1/smolagent-runtime`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({
          action: 'run',
          task: message,
          agent_id,
          session_id: session_id || crypto.randomUUID(),
        }),
      });

      const result = await resp.json();
      return jsonResponse(req, {
        response: (result as Record<string, unknown>).final_answer || (result as Record<string, unknown>).result || 'Sem resposta',
        session_id: session_id || crypto.randomUUID(),
      });
    } catch (error) {
      return errorResponse(req, error instanceof Error ? error.message : 'Chat failed', 500);
    }
  }

  return errorResponse(req, 'Not found', 404);
});
